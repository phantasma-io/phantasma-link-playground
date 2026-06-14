// A small MobX store that wraps the legacy callback-based `PhantasmaLink` (v1-v4) behind the
// same surface the v5 store exposes, so both panels drive the identical OperationRunner/EventLog.

import { makeAutoObservable, runInAction } from "@phantasma/link-react";
import { PhantasmaLink, ProofOfWork } from "phantasma-sdk-ts/public";
import type { PanelLogEntry, PanelLogKind } from "@/components/panel/EventLog";
import { buildSoulTransferScript, parseSoulToAtoms, utf8ToHex } from "@/lib/tx";

type V4Status = "idle" | "connecting" | "connected" | "error";
type LinkResponse = Record<string, unknown> & { success?: boolean; hash?: unknown; signature?: unknown };

let seq = 0;
const MAX_LOG = 200;

export class V4LinkStore {
	status: V4Status = "idle";
	address?: string;
	nexus?: string;
	busyOp?: string;
	error?: string;
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
			this.error = undefined;
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
							this.error = msg;
							this.log("error", "fetchWallet", msg ?? "error");
						}),
				);
			},
			(msg) =>
				runInAction(() => {
					this.status = "error";
					this.error = msg;
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

	signMessage(message: string) {
		const hex = utf8ToHex(message);
		return this.runCallback(
			"signData",
			(cb, errcb) => this.link!.signData(hex, cb, errcb),
			(r) => `signature ${String(r.signature ?? "").slice(0, 24)}...`,
		);
	}

	transferSoul(to: string, amount: string) {
		let script: string;
		try {
			script = buildSoulTransferScript(this.address!, to, parseSoulToAtoms(amount));
		} catch (e) {
			this.log("error", "signTx", errMsg(e));
			return Promise.resolve();
		}
		return this.runCallback(
			"signTx",
			(cb, errcb) => this.link!.signTx(script, null, cb, errcb, ProofOfWork.None, "Ed25519"),
			(r) => `hash ${String(r.hash ?? "")}`,
		);
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
			this.error = undefined;
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
						this.error = msg;
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

function errMsg(e: unknown): string {
	if (e && typeof e === "object" && "message" in e) {
		return String((e as { message: unknown }).message);
	}
	return String(e);
}
