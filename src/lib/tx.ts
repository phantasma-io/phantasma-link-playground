// Transaction helpers shared by both panels. The SOUL-transfer VM script is identical for v4 and
// v5; only the envelope differs - v4 sends the raw script (the wallet wraps it), v5 sends a fully
// serialized unsigned Transaction.

import {
	ScriptBuilder,
	Transaction,
	Address,
	Bytes32,
	SmallString,
	TxMsg,
	TxMsgTransferFungible,
	TxTypes,
	CarbonBlob,
} from "phantasma-sdk-ts/public";
import { bytesToBase64 } from "phantasma-link-react";

const GAS_PRICE = 100000n;
const GAS_LIMIT = 21000n;
const CARBON_MAX_GAS = 100000n;

/** A token the playground can send. `decimals` drives amount parsing (SOUL 8, KCAL 10);
 * `carbonTokenId` is the on-chain numeric id the Carbon format transfers by. */
export interface TokenMeta {
	symbol: string;
	decimals: number;
	carbonTokenId: bigint;
}

// Carbon token ids are assigned on-chain; the wallet resolves a transfer's numeric id back to a
// symbol via getToken().carbonId. Verified on mainnet and localnet (2026-06-14): SOUL=2, KCAL=1.
// Carbon id 0 does not resolve - the wallet error "Cannot load token for carbon ID 0" came from a
// previous SOUL=0 here.
export const TOKENS: Record<string, TokenMeta> = {
	SOUL: { symbol: "SOUL", decimals: 8, carbonTokenId: 2n },
	KCAL: { symbol: "KCAL", decimals: 10, carbonTokenId: 1n },
};

/** Parse a decimal amount string (e.g. "0.05") into the token's atoms. Throws on bad input. */
export function parseAmountToAtoms(input: string, decimals: number): bigint {
	const s = input.trim();
	if (!/^\d+(\.\d+)?$/.test(s)) {
		throw new Error(`Invalid amount: "${input}"`);
	}
	const [whole, frac = ""] = s.split(".");
	const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
	return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** A fungible-transfer VM script (hex): allowGas -> transferTokens -> spendGas. */
export function buildTransferScript(symbol: string, from: string, to: string, amountAtoms: bigint): string {
	return new ScriptBuilder()
		.beginScript()
		.allowGas(from, Address.nullAddress, GAS_PRICE, GAS_LIMIT)
		.transferTokens(symbol, from, to, amountAtoms)
		.spendGas(from)
		.endScript();
}

/** A full unsigned v5 Transaction (base64) for sendTransaction({ format: "script" }). */
export function buildTransferTxBase64(
	symbol: string,
	from: string,
	to: string,
	amountAtoms: bigint,
	nexus: string,
): string {
	const script = buildTransferScript(symbol, from, to, amountAtoms);
	const expiry = new Date(Date.now() + 10 * 60 * 1000);
	const tx = new Transaction(nexus, "main", script, expiry, "");
	return bytesToBase64(tx.toByteArray(false));
}

/** Build a Carbon TxMsg for a fungible transfer. v4 signs the TxMsg object directly
 * (signCarbonTxAndBroadcast); v5 sends its serialized bytes. Carbon transfers by numeric token
 * id, not symbol, so `tokenId` must be the on-chain id of the token being sent.
 *
 * The Carbon `expiry` is a unix timestamp in MILLISECONDS (the chain compares it against its own
 * millisecond clock; a seconds value is read as the far past and rejected as "Transaction has
 * expired"). This matches the wallet (PoltergeistLite WalletTransferService:
 * `DateTimeOffset.UtcNow.AddSeconds(30).ToUnixTimeMilliseconds()`). We use a longer window than the
 * wallet's 30s because a dApp tx must survive the user's approval round-trip. */
export function buildCarbonTransferMsg(
	from: string,
	to: string,
	amountAtoms: bigint,
	tokenId: bigint,
): TxMsg {
	const sender = new Bytes32(Address.fromText(from).getPublicKey());
	const receiver = new Bytes32(Address.fromText(to).getPublicKey());
	return new TxMsg(
		TxTypes.TransferFungible,
		BigInt(Date.now() + 10 * 60 * 1000),
		CARBON_MAX_GAS,
		0n,
		sender,
		SmallString.empty,
		new TxMsgTransferFungible(receiver, tokenId, amountAtoms),
	);
}

/** The serialized Carbon TxMsg (base64) for v5 sendTransaction({ format: "carbon" }). */
export function buildCarbonTransferTxBase64(
	from: string,
	to: string,
	amountAtoms: bigint,
	tokenId: bigint,
): string {
	return bytesToBase64(CarbonBlob.serialize(buildCarbonTransferMsg(from, to, amountAtoms, tokenId)));
}

/** UTF-8 -> hex (for the v4 signData path, which takes hex). */
export function utf8ToHex(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let hex = "";
	for (const b of bytes) {
		hex += b.toString(16).padStart(2, "0");
	}
	return hex;
}
