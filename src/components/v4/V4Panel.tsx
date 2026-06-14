"use client";

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { Button } from "@/components/ui/button";
import { PanelShell, type PanelStatusTone } from "@/components/panel/PanelShell";
import { OperationRunner } from "@/components/panel/OperationRunner";
import { EventLog } from "@/components/panel/EventLog";
import { AccountInfo } from "@/components/panel/AccountInfo";
import { V4LinkStore } from "./v4-store";
import { DAPP_METADATA } from "@/lib/dapp";

function toneOf(status: string): PanelStatusTone {
	if (status === "connected") return "connected";
	if (status === "error") return "error";
	if (status === "connecting") return "pending";
	return "idle";
}

export const V4Panel = observer(function V4Panel() {
	const store = useMemo(() => new V4LinkStore(DAPP_METADATA.name), []);
	useEffect(() => () => store.dispose(), [store]);

	return (
		<PanelShell
			version="v4"
			title="Phantasma Link v4 (legacy)"
			subtitle="Local socket / injected wallet, callback-based, version-gated"
			statusLabel={store.status}
			statusTone={toneOf(store.status)}
			headerRight={
				store.connected ? (
					<Button variant="outline" size="sm" onClick={() => store.disconnect()}>
						Disconnect
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						disabled={store.status === "connecting"}
						onClick={() => store.connect()}
					>
						{store.status === "connecting" ? "Connecting..." : "Connect wallet"}
					</Button>
				)
			}
		>
			<div className="grid gap-5 lg:grid-cols-2">
				<div className="space-y-4">
					<AccountInfo address={store.address} />
					<OperationRunner
						disabled={!store.connected}
						busyOp={store.busyOp}
						onGetChains={() => void store.getChains()}
						onSignMessage={(m) => void store.signMessage(m)}
						onTransferSoul={(to, amount) => void store.transferSoul(to, amount)}
					/>
				</div>
				<EventLog logs={store.logs} onClear={() => store.clearLogs()} />
			</div>
		</PanelShell>
	);
});
