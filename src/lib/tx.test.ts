// Unit tests for the pure transaction helpers. Run with `npm test` (vitest). Covers amount
// parsing, the Carbon token-id map (which is easy to get wrong - see SOUL=2), and the v4
// random-prefixed signature verification convention the V4LinkStore relies on.

import { describe, it, expect } from "vitest";
import {
	parseAmountToAtoms,
	TOKENS,
	utf8ToHex,
	buildCarbonTransferMsg,
	buildTokenDecimalsScriptBase64,
	buildPlannedCarbonTransferTxBase64,
	decodeInvokeResult,
	planCarbonTransferMsg,
} from "./tx";
import { networkForNexus } from "./dapp";
import { base64ToBytes } from "phantasma-link-react";
import {
	CarbonBlob,
	FeePlanner,
	TxMsg,
	type GasConfigResult,
	generateNewWif,
	getPrivateKeyFromWif,
	getAddressFromWif,
	signData,
	verifyData,
} from "phantasma-sdk-ts/public";

describe("parseAmountToAtoms", () => {
	it("scales by the token's decimals", () => {
		expect(parseAmountToAtoms("0.05", 8)).toBe(5_000_000n); // 0.05 SOUL (8 decimals)
		expect(parseAmountToAtoms("0.05", 10)).toBe(500_000_000n); // 0.05 KCAL (10 decimals)
		expect(parseAmountToAtoms("1", 8)).toBe(100_000_000n);
		expect(parseAmountToAtoms("12", 8)).toBe(1_200_000_000n);
	});

	it("truncates fraction digits beyond the decimal precision", () => {
		expect(parseAmountToAtoms("0.123456789", 4)).toBe(1234n);
	});

	it("throws on non-numeric or empty input", () => {
		expect(() => parseAmountToAtoms("abc", 8)).toThrow();
		expect(() => parseAmountToAtoms("", 8)).toThrow();
		expect(() => parseAmountToAtoms("1.2.3", 8)).toThrow();
	});
});

describe("TOKENS Carbon ids", () => {
	// Regression guard for the "Cannot load token for carbon ID 0" bug: SOUL's on-chain Carbon id
	// is 2, not 0 (verified via getToken on mainnet and localnet, 2026-06-14); KCAL is 1.
	it("uses the chain-verified Carbon token ids and decimals", () => {
		expect(TOKENS.SOUL.carbonTokenId).toBe(2n);
		expect(TOKENS.SOUL.decimals).toBe(8);
		expect(TOKENS.KCAL.carbonTokenId).toBe(1n);
		expect(TOKENS.KCAL.decimals).toBe(10);
	});
});

describe("buildCarbonTransferMsg expiry", () => {
	// Regression guard for the "Transaction has expired" bug: the Carbon expiry must be a future
	// unix timestamp in MILLISECONDS (the chain clocks in ms). A seconds value (~1.7e9) is < 1e12
	// and gets read as the far past, so the chain rejects the tx as expired.
	it("sets expiry as a future unix timestamp in milliseconds", () => {
		const addr = getAddressFromWif(generateNewWif());
		const before = Date.now();
		const msg = buildCarbonTransferMsg(addr, addr, 1000n, TOKENS.SOUL.carbonTokenId);
		const expiry = Number(msg.expiry);
		expect(expiry).toBeGreaterThan(before);
		expect(expiry).toBeGreaterThan(1_000_000_000_000);
	});
});

// getGasConfig of the local node (gas model v2), read 2026-10-06.
const LOCALNET_GAS_CONFIG = {
	gasModelVersion: 2,
	gasConfig: {
		version: 1,
		maxNameLength: 255,
		maxTokenSymbolLength: 255,
		feeShift: 0,
		maxStructureSize: 1048576,
		feeMultiplier: "10000",
		gasTokenId: "1",
		dataTokenId: "2",
		minimumGasOffer: "10",
		dataEscrowPerRow: "200000",
		gasFeeTransfer: "10",
		gasFeeQuery: "10",
		gasFeeCreateTokenBase: "10000000000",
		gasFeeCreateTokenSymbol: "10000000000",
		gasFeeCreateTokenSeries: "2500000000",
		gasFeePerByte: "250000",
		gasFeeRegisterName: "10000000000000",
		gasBurnRatioMul: "1",
		gasBurnRatioShift: 0,
		minimumGasBill: "10000000",
		gasProducerRatioMul: "0",
		gasProducerRatioShift: 0,
		gasDappRatioMul: "0",
		gasDappRatioShift: 0,
		policyFeeCreateTokenBase: "100000000000000",
		policyFeeCreateTokenSymbol: "100000000000000",
		policyFeeCreateTokenSeries: "25000000000000",
		policyFeeRegisterName: "100000000000000000",
		legacyDataEscrowPerRow: "2",
	},
	blockRateTarget: 1000,
	expiryWindow: 3600000,
	unitsPerBlockDataByte: 25,
} as unknown as GasConfigResult;

describe("planned Carbon transfers", () => {
	// Regression guard for "below minimum gas bill": gas model v2 bills the whole envelope per
	// byte, so the offer comes from the network's config, not from a constant.
	it("offers the gas the network's config asks for", async () => {
		const fees = new FeePlanner({ getGasConfig: async () => LOCALNET_GAS_CONFIG });
		const from = getAddressFromWif(generateNewWif());
		const to = getAddressFromWif(generateNewWif());
		const planned = await planCarbonTransferMsg(fees, from, to, 1000n, TOKENS.SOUL.carbonTokenId);
		expect(planned.maxGas).toBeGreaterThanOrEqual(10_000_000n);
		expect(planned.maxGas).toBe((await fees.plan(buildCarbonTransferMsg(from, to, 1000n, 2n))).maxGas);

		// v5 sends the same planned message, serialized.
		const tx = await buildPlannedCarbonTransferTxBase64(fees, from, to, 1000n, TOKENS.SOUL.carbonTokenId);
		const msg = CarbonBlob.fromBytesChecked(TxMsg, base64ToBytes(tx), false, 0);
		expect(msg.maxGas).toBe(planned.maxGas);
	});

	// The v4 panel plans against the chain its wallet reports, picked by the nexus name.
	it("finds the network for the nexus a wallet reports", () => {
		expect(networkForNexus("simnet")?.rpc).toBe("http://localhost:5172/rpc");
		expect(networkForNexus("mainnet")?.id).toBe("mainnet");
		expect(networkForNexus("testnet")?.id).toBe("testnet");
		expect(networkForNexus("unknown")).toBeUndefined();
		expect(networkForNexus(undefined)).toBeUndefined();
	});
});

describe("invokeScript helpers", () => {
	// Spec 9.5: each result is one VM object as the chain serializes it, in base64. 0x03 is the
	// Number type, then a length byte and the value: 8, the SOUL decimals.
	it("decodes a base64 VM result", () => {
		expect(decodeInvokeResult("AwEI")).toBe("8");
	});

	// The hex answer of wallets that predate spec 1.2 ("03020800" from the node) must not pass.
	it("refuses a hex result", () => {
		expect(() => decodeInvokeResult("03020800")).toThrow();
	});

	it("builds the decimals script as base64", () => {
		const script = new TextDecoder().decode(base64ToBytes(buildTokenDecimalsScriptBase64("SOUL")));
		expect(script).toContain("Runtime.GetTokenDecimals");
		expect(script).toContain("SOUL");
	});
});

describe("utf8ToHex", () => {
	it("encodes UTF-8 bytes as lowercase hex", () => {
		expect(utf8ToHex("ABC")).toBe("414243");
	});
});

describe("v4 random-prefixed signature verification", () => {
	// The v4 wallet signs `random || data` and returns the random it prepended; V4LinkStore then
	// calls verifyData(random + dataHex, sig, address). This proves that convention round-trips and
	// would fail if the concatenation order regressed.
	const wif = generateNewWif();
	const priv = getPrivateKeyFromWif(wif);
	const address = getAddressFromWif(wif);
	const randomHex = "1a2b3c4d"; // 4 random bytes, as the wallet uses

	it("verifies a signature over random||data", () => {
		const signedHex = randomHex + utf8ToHex("Hello from the tester");
		const sig = signData(signedHex, priv);
		expect(verifyData(signedHex, sig, address)).toBe(true);
	});

	it("rejects when the data differs from what was signed", () => {
		const sig = signData(randomHex + utf8ToHex("original"), priv);
		expect(verifyData(randomHex + utf8ToHex("tampered"), sig, address)).toBe(false);
	});
});
