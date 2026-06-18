// A small MobX store that wraps the legacy callback-based `PhantasmaLink` (v1-v4) behind the
// same surface the v5 store exposes, so both panels drive the identical OperationRunner/EventLog.

import { makeAutoObservable, runInAction, errMsg } from "phantasma-link-react";
import { PhantasmaLink, ProofOfWork, verifyData } from "phantasma-sdk-ts/public";
import type { PanelLogEntry, PanelLogKind } from "@/components/panel/EventLog";
import { buildTransferScript, buildCarbonTransferMsg, parseAmountToAtoms, utf8ToHex, TOKENS } from "@/lib/tx";

type V4Status = "idle" | "connecting" | "connected" | "error";
type LinkResponse = Record<string, unknown> & { hash?: unknown; signature?: unknown };

let seq = 0;
const MAX_LOG = 200;

export class V4LinkStore {
	status: V4Status = "idle";
	address?: string;
	nexus?: string;
	busyOp?: string;
	logs: PanelLogEntry[] = [];
	private link?: PhantasmaLink;

	constructor(private readonly dappId: string) {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	get connected(): boolean {
		return this.status === "connected" && !!this.address;
	}

	log(kind: PanelLogKind, label: string, detail?: string): void {
		this.logs.unshift({ id: `v4-${++seq}`, ts: Date.now(), kind, label, detail });
		if (this.logs.length > MAX_LOG) {
			this.logs.length = MAX_LOG;
		}
	}

	clearLogs(): void {
		this.logs = [];
	}

	connect(): void {
		runInAction(() => {
			this.status = "connecting";
		});
		this.log("request", "login");
		const link = new PhantasmaLink(this.dappId, false);
		this.link = link;
		link.login(
			(success) => {
				if (!success) {
					runInAction(() => {
						this.status = "error";
						this.log("error", "login", "wallet returned failure");
					});
					return;
				}
				link.fetchWallet(
					() =>
						runInAction(() => {
							this.address = link.account?.address;
							this.nexus = link.nexus;
							this.status = "connected";
							this.log("result", "login", this.address);
						}),
					(msg) =>
						runInAction(() => {
							this.status = "error";
							this.log("error", "fetchWallet", msg ?? "error");
						}),
				);
			},
			(msg) =>
				runInAction(() => {
					this.status = "error";
					this.log("error", "login", msg ?? "error");
				}),
			4,
			"phantasma",
			"poltergeist",
		);
	}

	disconnect(): void {
		runInAction(() => {
			this.address = undefined;
			this.nexus = undefined;
			this.status = "idle";
			this.link = undefined;
		});
		this.log("info", "disconnect", "local state cleared");
	}

	getChains() {
		return this.runCallback(
			"getNexus",
			(cb, errcb) => this.link!.getNexus(cb, errcb),
			() => `nexus ${this.nexus ?? "?"}`,
		);
	}

	cancel(): void {
		runInAction(() => {
			this.status = "idle";
			this.address = undefined;
			this.link = undefined;
		});
		this.log("info", "connect cancelled");
	}

	signMessage(message: string) {
		const hex = utf8ToHex(message);
		return this.runCallback(
			"signData",
			(cb, errcb) => this.link!.signData(hex, cb, errcb),
			(r) => {
				const sig = String(r.signature ?? "");
				const random = String(r.random ?? "");
				let verified: boolean | null = null;
				try {
					// v4 signData signs `random || data` and returns the random it prepended.
					verified = verifyData(random + hex, sig, this.address ?? "");
				} catch {
					verified = null;
				}
				return `verified ${verified === null ? "n/a" : verified ? "VALID" : "INVALID"} | ${sig.slice(0, 16)}...`;
			},
		);
	}

	sendTokens(to: string, amount: string, token: string, format: "script" | "carbon") {
		try {
			const meta = TOKENS[token];
			const atoms = parseAmountToAtoms(amount, meta?.decimals ?? 8);
			if (format === "carbon") {
				const txMsg = buildCarbonTransferMsg(this.address!, to, atoms, meta?.carbonTokenId ?? 0n);
				return this.runCallback(
					"signCarbonTx",
					(cb, errcb) => this.link!.signCarbonTxAndBroadcast(txMsg, cb, errcb),
					(r) => `hash ${String(r.hash ?? "")}`,
				);
			}
			const script = buildTransferScript(meta?.symbol ?? token, this.address!, to, atoms);
			return this.runCallback(
				"signTx",
				(cb, errcb) => this.link!.signTx(script, null, cb, errcb, ProofOfWork.None, "Ed25519"),
				(r) => `hash ${String(r.hash ?? "")}`,
			);
		} catch (e) {
			this.log("error", "send", errMsg(e));
			return Promise.resolve();
		}
	}

	private runCallback(
		label: string,
		invoke: (cb: (r: LinkResponse) => void, errcb: (msg?: string) => void) => void,
		describe: (r: LinkResponse) => string,
	): Promise<void> {
		if (!this.link || !this.connected) {
			this.log("error", label, "not connected");
			return Promise.resolve();
		}
		runInAction(() => {
			this.busyOp = label;
		});
		this.log("request", label);
		return new Promise<void>((resolve) => {
			invoke(
				(result) =>
					runInAction(() => {
						this.busyOp = undefined;
						this.log("result", label, describe(result));
						resolve();
					}),
				(msg) =>
					runInAction(() => {
						this.busyOp = undefined;
						this.log("error", label, msg ?? "error");
						resolve();
					}),
			);
		});
	}

	dispose(): void {
		this.link = undefined;
	}
}
