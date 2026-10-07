"use client";

import { useEffect, useMemo, useState } from "react";
import {
	observer,
	usePhantasmaLink,
	ConnectWidget,
	TxFormat,
	errMsg,
	type LinkTransportKind,
	type RequestSigningPermissionParams,
} from "phantasma-link-react";
import { findInjectedProvider } from "phantasma-sdk-ts/link/v5";
import { PhantasmaAPI } from "phantasma-sdk-ts/public";
import { PanelShell, type PanelStatusTone } from "@/components/panel/PanelShell";
import { OperationRunner } from "@/components/panel/OperationRunner";
import { EventLog } from "@/components/panel/EventLog";
import { AccountInfo, type AccountBalance } from "@/components/panel/AccountInfo";
import { SigningPermissionRunner } from "@/components/v5/SigningPermissionRunner";
import {
	buildContractCallTxBase64,
	buildTransferTxBase64,
	buildPlannedCarbonTransferTxBase64,
	buildTokenDecimalsScriptBase64,
	decodeInvokeResult,
	parseAmountToAtoms,
	TOKENS,
} from "@/lib/tx";
import { buildPermissionRequest, callTxExpiry, parseCallArgs } from "@/lib/permission";
import { NETWORKS, DEFAULT_NETWORK } from "@/lib/dapp";

const selectClass =
	"rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring";

function toneOf(status: string): PanelStatusTone {
	if (status === "connected") return "connected";
	if (status === "error") return "error";
	if (status === "pairing" || status === "connecting") return "pending";
	return "idle";
}

export const V5Panel = observer(function V5Panel() {
	const link = usePhantasmaLink();
	// Select by network id, not by nexus: devnet and testnet share the "testnet" nexus, so a
	// nexus-keyed selector cannot tell them apart.
	const [networkId, setNetworkId] = useState(DEFAULT_NETWORK.id);
	const network = NETWORKS.find((n) => n.id === networkId) ?? DEFAULT_NETWORK;
	// Carbon fees are planned against the selected network's gas config (read over its RPC).
	const fees = useMemo(() => new PhantasmaAPI(network.rpc, null, network.nexus).fees, [network.rpc, network.nexus]);
	// The extension defines `window.phantasmaLink` before the page's scripts run (spec
	// section 6.1). Read it after mount so the server-rendered markup and the first client
	// render agree; the option is offered only when a wallet extension is present.
	const [extensionPresent, setExtensionPresent] = useState(false);
	useEffect(() => {
		setExtensionPresent(findInjectedProvider() !== undefined);
	}, []);

	// True when the wallet has reported the signing permission of this session, or that it has none
	// (spec 9.8). The store keeps no permission across a page reload, so the panel tells "none" from
	// "not known yet".
	const [permissionKnown, setPermissionKnown] = useState(false);

	// Enforce the network at connect time. The wallet signs on ITS OWN nexus, so a wallet on a
	// different nexus than the one selected here must NOT stay connected: once the session is up we
	// read the wallet's nexus and, on a mismatch, disconnect immediately - there is no usable
	// session on the wrong network. (Devnet and Testnet share the "testnet" nexus, so this cannot
	// tell those two apart - only the wallet-side check / RPC can.)
	useEffect(() => {
		setPermissionKnown(false);
		if (!link.connected) return;
		void link.getChains().then((r) => {
			if (r?.nexus && r.nexus !== network.nexus) {
				const wallet = r.nexus;
				// Logged after the disconnect: the store rebuilds its client then and logs
				// "Client ready", which would bury a refusal logged first and read like a hang.
				void link.disconnect().then(() => {
					link.log(
						"error",
						"connect",
						`refused: wallet nexus "${wallet}" != selected network "${network.nexus}". Switch the wallet (Settings > Nexus) and reconnect.`,
					);
				});
				return;
			}
			// The extension and the desktop wallet answer at once, so the panel reads the session's
			// permission by itself. Over deeplink and relay the request would go to the phone and
			// bring the wallet to the front, so there the user reads it with "Get permission".
			if (link.transport === "injected" || link.transport === "loopback") {
				void link.getSigningPermission().then((read) => {
					if (read !== undefined) setPermissionKnown(true);
				});
			}
		});
	}, [link, link.connected, network.nexus]);

	const balances: AccountBalance[] | undefined = link.account?.balances?.map((b) => ({
		symbol: b.symbol,
		amount: b.value,
	}));

	const buildTransfer = async (from: string, to: string, amount: string, token: string, format: "script" | "carbon") => {
		const meta = TOKENS[token];
		const atoms = parseAmountToAtoms(amount, meta?.decimals ?? 8);
		const tx =
			format === "carbon"
				? await buildPlannedCarbonTransferTxBase64(fees, from, to, atoms, meta?.carbonTokenId ?? 0n)
				: buildTransferTxBase64(meta?.symbol ?? token, from, to, atoms, network.nexus);
		return { format: format === "carbon" ? TxFormat.Carbon : TxFormat.Script, tx };
	};

	const sendTokens = (to: string, amount: string, token: string, format: "script" | "carbon") => {
		if (!link.address) return;
		void buildTransfer(link.address, to, amount, token, format).then(
			(params) => link.sendTransaction(params),
			(e: unknown) => link.log("error", "sendTransaction", errMsg(e)),
		);
	};

	// The wallet signs the transfer exactly as built here and returns it unsent (spec 9.5).
	const signTokens = (to: string, amount: string, token: string, format: "script" | "carbon") => {
		if (!link.address) return;
		void buildTransfer(link.address, to, amount, token, format).then(
			(params) => link.signTransaction(params),
			(e: unknown) => link.log("error", "signTransaction", errMsg(e)),
		);
	};

	const requestPermission = (contract: string, methods: string, minutes: string, budgetKcal: string) => {
		let params: RequestSigningPermissionParams;
		try {
			params = buildPermissionRequest(contract, methods, minutes, budgetKcal);
		} catch (e) {
			link.log("error", "requestSigningPermission", errMsg(e));
			return;
		}
		void link.requestSigningPermission(params).then((granted) => {
			if (granted !== undefined) setPermissionKnown(true);
		});
	};

	// A read or a revoke that the wallet answered tells the panel the state of the permission.
	const getPermission = () => {
		void link.getSigningPermission().then((read) => {
			if (read !== undefined) setPermissionKnown(true);
		});
	};
	const revokePermission = () => {
		void link.revokeSigningPermission().then((revoked) => {
			if (revoked !== undefined) setPermissionKnown(true);
		});
	};

	const callContract = (contract: string, method: string, args: string) => {
		if (!link.address) return;
		const expiresAt = callTxExpiry(Date.now(), link.signingPermission?.expiresAt);
		let tx: string;
		try {
			tx = buildContractCallTxBase64(
				contract.trim(),
				method.trim(),
				parseCallArgs(args, link.address),
				link.address,
				network.nexus,
				expiresAt,
			);
		} catch (e) {
			link.log("error", "sendTransaction", errMsg(e));
			return;
		}
		void link.sendTransaction({ format: TxFormat.Script, tx });
	};

	// Reads the SOUL decimals through the wallet's node. The result is a base64 VM object (spec
	// 9.5); a wallet that answers in another encoding shows up here as a decode error.
	const invokeScript = async () => {
		const result = await link.invokeScript({ chain: "main", script: buildTokenDecimalsScriptBase64("SOUL") });
		const first = result?.results[0];
		if (first === undefined) return;
		try {
			link.log("info", "invokeScript", `SOUL decimals: ${String(decodeInvokeResult(first))}`);
		} catch (e) {
			link.log("error", "invokeScript", `result is not a base64 VM object: ${errMsg(e)}`);
		}
	};

	return (
		<PanelShell
			version="v5"
			title="Phantasma Link v5"
			subtitle="Capability handshake; extension, loopback, deeplink and relay transports"
			statusLabel={link.status}
			statusTone={toneOf(link.status)}
			headerRight={<ConnectWidget />}
		>
			<div className="grid gap-5 lg:grid-cols-2">
				<div className="space-y-4">
					<div className="flex flex-wrap gap-4">
						<label className="text-xs">
							<span className="mb-1 block text-muted-foreground">Transport</span>
							<select
								className={selectClass}
								value={link.transport}
								onChange={(e) => void link.setTransport(e.target.value as LinkTransportKind)}
							>
								<option value="injected" disabled={!extensionPresent}>
									{extensionPresent ? "Extension (browser wallet)" : "Extension (no wallet extension detected)"}
								</option>
								<option value="loopback">Loopback (desktop socket)</option>
								<option value="relay">Relay (cross-device QR)</option>
								<option value="deeplink">Deeplink (same device)</option>
							</select>
						</label>
						<label className="text-xs">
							<span className="mb-1 block text-muted-foreground">Network (tx nexus)</span>
							<select
								className={selectClass}
								value={networkId}
								disabled={link.connected}
								onChange={(e) => setNetworkId(e.target.value)}
							>
								{NETWORKS.map((n) => (
									<option key={n.id} value={n.id}>
										{n.label}
									</option>
								))}
							</select>
						</label>
					</div>
					<AccountInfo address={link.address} balances={balances} wallet={link.walletInfo} />
					<OperationRunner
						disabled={!link.connected}
						busyOp={link.busyOp}
						onGetChains={() => void link.getChains()}
						onGetWalletInfo={() => void link.getWalletInfo()}
						onInvokeScript={() => void invokeScript()}
						onSignMessage={(m) => void link.signMessage(m)}
						onSendTokens={sendTokens}
						onSignTokens={signTokens}
					/>
					<SigningPermissionRunner
						disabled={!link.connected}
						busyOp={link.busyOp}
						permission={link.signingPermission}
						permissionKnown={permissionKnown}
						onRequest={requestPermission}
						onGet={getPermission}
						onRevoke={revokePermission}
						onCall={callContract}
					/>
				</div>
				<EventLog logs={link.logs} onClear={() => link.clearLogs()} />
			</div>
		</PanelShell>
	);
});
