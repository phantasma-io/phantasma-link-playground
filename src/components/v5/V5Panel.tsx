"use client";

import { useState } from "react";
import { observer, usePhantasmaLink, ConnectWidget, TxFormat } from "@phantasma/link-react";
import { PanelShell, type PanelStatusTone } from "@/components/panel/PanelShell";
import { OperationRunner } from "@/components/panel/OperationRunner";
import { EventLog } from "@/components/panel/EventLog";
import { AccountInfo, type AccountBalance } from "@/components/panel/AccountInfo";
import { buildSoulTransferTxBase64, buildCarbonTransferTxBase64, parseSoulToAtoms } from "@/lib/tx";
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
	const [nexus, setNexus] = useState(DEFAULT_NETWORK.nexus);

	const balances: AccountBalance[] | undefined = link.account?.balances?.map((b) => ({
		symbol: b.symbol,
		amount: b.value,
	}));

	const transferSoul = (to: string, amount: string, format: "script" | "carbon", tokenId: string) => {
		if (!link.address) return;
		try {
			const atoms = parseSoulToAtoms(amount);
			const tx =
				format === "carbon"
					? buildCarbonTransferTxBase64(link.address, to, atoms, BigInt(tokenId))
					: buildSoulTransferTxBase64(link.address, to, atoms, nexus);
			void link.sendTransaction({ format: format === "carbon" ? TxFormat.Carbon : TxFormat.Script, tx });
		} catch (e) {
			link.log("error", "sendTransaction", e instanceof Error ? e.message : String(e));
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
							<select className={selectClass} value={nexus} onChange={(e) => setNexus(e.target.value)}>
								{NETWORKS.map((n) => (
									<option key={n.id} value={n.nexus}>
										{n.label}
									</option>
								))}
							</select>
						</label>
					</div>
					<AccountInfo address={link.address} balances={balances} />
					<OperationRunner
						disabled={!link.connected}
						busyOp={link.busyOp}
						onGetChains={() => void link.getChains()}
						onGetWalletInfo={() => void link.getWalletInfo()}
						onSignMessage={(m) => void link.signMessage(m)}
						onTransferSoul={transferSoul}
					/>
				</div>
				<EventLog logs={link.logs} onClear={() => link.clearLogs()} />
			</div>
		</PanelShell>
	);
});
