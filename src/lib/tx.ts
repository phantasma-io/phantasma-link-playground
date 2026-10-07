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
	type FeePlanner,
	bytesToHex,
	decodeVMObject,
	hexToBytes,
} from "phantasma-sdk-ts/public";
import { base64ToBytes, bytesToBase64 } from "phantasma-link-react";

const GAS_PRICE = 100000n;
const GAS_LIMIT = 21000n;
const CARBON_MAX_GAS = 100000n;
/** Gas limit of one contract call. A small method such as a game move stays below it on the
 * localnet. */
const CALL_GAS_LIMIT = 100000n;

/** The most gas one contract call can cost the account, in KCAL atoms: `price × limit` of its
 * AllowGas. A signing permission reserves this amount against its gas budget (Link spec 1.2, 9.8). */
export const CALL_GAS_COST = GAS_PRICE * CALL_GAS_LIMIT;

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

/** A full unsigned v5 Transaction (base64) that calls one contract method in the standard form:
 * AllowGas, the call, SpendGas. A wallet signs only this form without a prompt under a signing
 * permission (Link spec 1.2, 9.8). The caller passes the expiry, because such a transaction must
 * expire no later than the permission. */
export function buildContractCallTxBase64(
	contract: string,
	method: string,
	args: unknown[],
	from: string,
	nexus: string,
	expiresAt: Date,
): string {
	const script = new ScriptBuilder()
		.beginScript()
		.allowGas(from, Address.nullAddress, GAS_PRICE, CALL_GAS_LIMIT)
		.callContract(contract, method, args)
		.spendGas(from)
		.endScript();
	const tx = new Transaction(nexus, "main", script, expiresAt, "");
	return bytesToBase64(tx.toByteArray(false));
}

/** Build a Carbon TxMsg for a fungible transfer. v4 signs the TxMsg object directly
 * (signCarbonTxAndBroadcast); v5 sends its serialized bytes. Carbon transfers by numeric token
 * id, not symbol, so `tokenId` must be the on-chain id of the token being sent. Its `maxGas` is a
 * placeholder: both panels send the message planned by {@link planCarbonTransferMsg}.
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

/** A Carbon fungible transfer with `maxGas` and `maxData` planned against the network's current
 * gas config. Gas model v2 bills the whole signed envelope per byte, so a fixed offer is refused
 * below the minimum bill, and wallets sign the transaction exactly as built (Link spec 1.2, 9.5;
 * PoltergeistLite does the same for v4): planning is the dApp's job. */
export async function planCarbonTransferMsg(
	fees: FeePlanner,
	from: string,
	to: string,
	amountAtoms: bigint,
	tokenId: bigint,
): Promise<TxMsg> {
	const msg = buildCarbonTransferMsg(from, to, amountAtoms, tokenId);
	const plan = await fees.plan(msg);
	return plan.apply(msg);
}

/** The planned Carbon transfer, serialized (base64), for v5 sendTransaction({ format: "carbon" }). */
export async function buildPlannedCarbonTransferTxBase64(
	fees: FeePlanner,
	from: string,
	to: string,
	amountAtoms: bigint,
	tokenId: bigint,
): Promise<string> {
	const msg = await planCarbonTransferMsg(fees, from, to, amountAtoms, tokenId);
	return bytesToBase64(CarbonBlob.serialize(msg));
}

/** A read-only VM script (base64) for v5 invokeScript: the token's decimals as the chain reports
 * them. It needs no keys and no approval, so it checks the wallet's node and the result encoding. */
export function buildTokenDecimalsScriptBase64(symbol: string): string {
	const script = new ScriptBuilder()
		.beginScript()
		.callInterop("Runtime.GetTokenDecimals", [symbol])
		.endScript();
	return bytesToBase64(hexToBytes(script));
}

/** Decode one v5 invokeScript result: a VM object as the chain serializes it, in base64 (spec
 * 9.5). Throws when the value is not in that encoding. */
export function decodeInvokeResult(result: string): unknown {
	return decodeVMObject(bytesToHex(base64ToBytes(result)));
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
