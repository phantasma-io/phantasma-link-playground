"use client";

import { useEffect, useState } from "react";
import { observer, usePhantasmaLink, ConnectWidget, TxFormat, errMsg } from "phantasma-link-react";
import { PanelShell, type PanelStatusTone } from "@/components/panel/PanelShell";
import { OperationRunner } from "@/components/panel/OperationRunner";
import { EventLog } from "@/components/panel/EventLog";
import { AccountInfo, type AccountBalance } from "@/components/panel/AccountInfo";
import { buildTransferTxBase64, buildCarbonTransferTxBase64, parseAmountToAtoms, TOKENS } from "@/lib/tx";
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

	// Enforce the network at connect time. The wallet signs on ITS OWN nexus, so a wallet on a
	// different nexus than the one selected here must NOT stay connected: once the session is up we
	// read the wallet's nexus and, on a mismatch, disconnect immediately - there is no usable
	// session on the wrong network. (Devnet and Testnet share the "testnet" nexus, so this cannot
	// tell those two apart - only the wallet-side check / RPC can.)
	useEffect(() => {
		if (!link.connected) return;
		void link.getChains().then((r) => {
			if (r?.nexus && r.nexus !== network.nexus) {
				link.log(
					"error",
					"connect",
					`refused: wallet nexus "${r.nexus}" != selected network "${network.nexus}". Switch the wallet (Settings > Nexus) and reconnect.`,
				);
				void link.disconnect();
			}
		});
	}, [link, link.connected, network.nexus]);

	const balances: AccountBalance[] | undefined = link.account?.balances?.map((b) => ({
		symbol: b.symbol,
		amount: b.value,
	}));

	const sendTokens = (to: string, amount: string, token: string, format: "script" | "carbon") => {
		if (!link.address) return;
		try {
			const meta = TOKENS[token];
			const atoms = parseAmountToAtoms(amount, meta?.decimals ?? 8);
			const tx =
				format === "carbon"
					? buildCarbonTransferTxBase64(link.address, to, atoms, meta?.carbonTokenId ?? 0n)
					: buildTransferTxBase64(meta?.symbol ?? token, link.address, to, atoms, network.nexus);
			void link.sendTransaction({ format: format === "carbon" ? TxFormat.Carbon : TxFormat.Script, tx });
		} catch (e) {
			link.log("error", "sendTransaction", errMsg(e));
		}
	};

	return (
		<PanelShell
			version="v5"
			title="Phantasma Link v5"
			subtitle="Capability handshake, encrypted transports, QR / deeplink pairing"
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
								onChange={(e) =>
									void link.setTransport(e.target.value as "loopback" | "deeplink" | "relay")
								}
							>
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
						onSignMessage={(m) => void link.signMessage(m)}
						onSendTokens={sendTokens}
					/>
				</div>
				<EventLog logs={link.logs} onClear={() => link.clearLogs()} />
			</div>
		</PanelShell>
	);
});
