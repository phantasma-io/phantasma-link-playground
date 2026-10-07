// Helpers of the signing permission demo (Link spec 1.2, 9.8): the request the site sends, and the
// arguments of a contract call it then sends under the permission. The form fields are plain text,
// so these functions turn them into the values the protocol and the script take.

import { Address, parseUnits } from "phantasma-sdk-ts/public";
import type { RequestSigningPermissionParams } from "phantasma-link-react";

const KCAL_DECIMALS = 10;

/** How long a contract call transaction stays valid, in milliseconds. */
export const CALL_TX_LIFETIME_MS = 2 * 60 * 1000;

/** Returns when a contract call sent at `now` expires. A call that the permission covers must expire
 * no later than the permission and within five minutes of its request (spec 9.8), so it expires in
 * two minutes, or earlier when the permission ends earlier. A permission that has already ended
 * limits nothing: the wallet shows its normal prompt for the call. */
export function callTxExpiry(now: number, permissionEnd: number | undefined): Date {
	const end = now + CALL_TX_LIFETIME_MS;
	if (permissionEnd === undefined || permissionEnd <= now) {
		return new Date(end);
	}
	return new Date(Math.min(end, permissionEnd));
}

/** Builds the request for a permission on methods of one contract. `methods` is a comma-separated
 * list, `minutes` the duration and `budgetKcal` the gas budget in KCAL. The wallet checks the
 * limits of the spec and answers -32602 when one is broken, so they are not repeated here. Throws
 * when the duration or the budget is not a number. */
export function buildPermissionRequest(
	contract: string,
	methods: string,
	minutes: string,
	budgetKcal: string,
): RequestSigningPermissionParams {
	const duration = Number(minutes.trim());
	if (minutes.trim() === "" || !Number.isFinite(duration)) {
		throw new Error(`Duration is not a number of minutes: "${minutes}"`);
	}
	return {
		calls: [{ contract: contract.trim(), methods: splitList(methods) }],
		duration: Math.round(duration * 60),
		gasLimit: parseUnits(budgetKcal.trim(), KCAL_DECIMALS).toString(),
	};
}

/** Reads the comma-separated arguments of a contract call, for example `me, 1` for a method
 * `(from: address, steps: number)`. `me` stands for the account's address. An address becomes an
 * Address, a whole number a Number, and any other text a String. */
export function parseCallArgs(text: string, me: string): unknown[] {
	return splitList(text).map((value) => {
		const address = value === "me" ? me : value;
		if (Address.isValidAddress(address)) {
			return Address.fromText(address);
		}
		if (/^-?\d+$/.test(value)) {
			return BigInt(value);
		}
		return value;
	});
}

function splitList(text: string): string[] {
	return text
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}
