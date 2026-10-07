// Unit tests for the signing permission demo (Link spec 1.2, 9.8): the request built from the form,
// the call arguments, and the call transaction checked by the SDK rule a wallet applies before it
// signs without a prompt.

import { describe, it, expect } from "vitest";
import {
	Address,
	Transaction,
	generateNewWif,
	getAddressFromWif,
	hexToBytes,
	readContractCalls,
} from "phantasma-sdk-ts/public";
import { matchSigningPermission, type SigningPermission } from "phantasma-sdk-ts/link/v5";
import { base64ToBytes } from "phantasma-link-react";
import { buildPermissionRequest, CALL_TX_LIFETIME_MS, callTxExpiry, parseCallArgs } from "./permission";
import { buildContractCallTxBase64, CALL_GAS_COST } from "./tx";

// Spec 9.8: a call under a permission expires within five minutes of its request and no later than
// the permission; a permission that has ended no longer limits the call.
describe("callTxExpiry", () => {
	const now = 1_800_000_000_000;

	it("gives a call two minutes without a permission", () => {
		expect(callTxExpiry(now, undefined).getTime()).toBe(now + CALL_TX_LIFETIME_MS);
	});

	it("ends a call with a permission that ends earlier", () => {
		expect(callTxExpiry(now, now + 30_000).getTime()).toBe(now + 30_000);
		expect(callTxExpiry(now, now + 600_000).getTime()).toBe(now + CALL_TX_LIFETIME_MS);
	});

	it("gives a call two minutes when the permission has already ended", () => {
		expect(callTxExpiry(now, now - 1).getTime()).toBe(now + CALL_TX_LIFETIME_MS);
		expect(callTxExpiry(now, now).getTime()).toBe(now + CALL_TX_LIFETIME_MS);
	});
});

describe("buildPermissionRequest", () => {
	it("turns the form fields into the request params", () => {
		expect(buildPermissionRequest(" game ", "move, withdraw", "15", "5")).toEqual({
			calls: [{ contract: "game", methods: ["move", "withdraw"] }],
			duration: 900,
			gasLimit: "50000000000", // 5 KCAL in atoms (10 decimals)
		});
	});

	it("throws on a duration or a budget that is not a number", () => {
		expect(() => buildPermissionRequest("game", "move", "soon", "5")).toThrow(/Duration/);
		expect(() => buildPermissionRequest("game", "move", "", "5")).toThrow(/Duration/);
		expect(() => buildPermissionRequest("game", "move", "15", "lots")).toThrow();
	});
});

describe("parseCallArgs", () => {
	const me = getAddressFromWif(generateNewWif());

	it("reads me and address texts as Address values, whole numbers as Numbers, the rest as Strings", () => {
		const other = getAddressFromWif(generateNewWif());
		const args = parseCallArgs(`me, ${other}, 7, -2, hello`, me);
		expect(args).toHaveLength(5);
		expect((args[0] as Address).text).toBe(me);
		expect((args[1] as Address).text).toBe(other);
		expect(args.slice(2)).toEqual([7n, -2n, "hello"]);
	});

	it("skips empty items", () => {
		expect(parseCallArgs(" , 1 ,, ", me)).toEqual([1n]);
	});
});

describe("buildContractCallTxBase64", () => {
	const account = getAddressFromWif(generateNewWif());
	const now = Date.now();
	const permission: SigningPermission = {
		id: "perm-1",
		chain: "main",
		calls: [{ contract: "game", methods: ["move"] }],
		expiresAt: now + 10 * 60 * 1000,
		gasLimit: (CALL_GAS_COST * 2n).toString(),
		gasReserved: "0",
	};
	const callTx = (method: string, expiresAt: number) =>
		Transaction.deserialize(
			base64ToBytes(
				buildContractCallTxBase64(
					"game",
					method,
					parseCallArgs("me, 1", account),
					account,
					"simnet",
					new Date(expiresAt),
				),
			),
		);

	// One click sends one call: the script holds the method call once, with its two arguments,
	// between the gas calls.
	it("calls the method once between AllowGas and SpendGas", () => {
		const calls = readContractCalls(hexToBytes(callTx("move", now + 60_000).script));
		expect(calls?.map((call) => [call.contract, call.method, call.args.length])).toEqual([
			["gas", "AllowGas", 4],
			["game", "move", 2],
			["gas", "SpendGas", 1],
		]);
	});

	// The wallet signs without a prompt only a transaction in the exact standard call form (spec
	// 9.8); the SDK rule is the one Aura applies, and it counts price × limit as the call's gas.
	it("builds a call that a permission on that method covers", () => {
		const match = matchSigningPermission({
			tx: callTx("move", now + 60_000),
			permission,
			account,
			now,
			sentAt: now,
		});
		expect(match).toEqual({ matched: true, accountGas: CALL_GAS_COST });
	});

	it("builds a call that a permission on other methods does not cover", () => {
		const match = matchSigningPermission({
			tx: callTx("withdraw", now + 60_000),
			permission,
			account,
			now,
			sentAt: now,
		});
		expect(match.matched).toBe(false);
	});

	// Spec 9.8: a transaction that outlives the permission gets the prompt, which is why V5Panel caps
	// the expiry at the end of the permission.
	it("builds a call with the expiry it is given", () => {
		const match = matchSigningPermission({
			tx: callTx("move", permission.expiresAt + 60_000),
			permission,
			account,
			now,
			sentAt: now,
		});
		expect(match.matched).toBe(false);
	});
});
