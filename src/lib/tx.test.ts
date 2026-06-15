// Unit tests for the pure transaction helpers. Run with `npm test` (vitest). Covers amount
// parsing, the Carbon token-id map (which is easy to get wrong - see SOUL=2), and the v4
// random-prefixed signature verification convention the V4LinkStore relies on.

import { describe, it, expect } from "vitest";
import { parseAmountToAtoms, TOKENS, utf8ToHex, buildCarbonTransferMsg } from "./tx";
import {
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
