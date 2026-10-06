"use client";

import { useEffect, useMemo, useState } from "react";
import { observer } from "phantasma-link-react";
import { Button } from "@/components/ui/button";
import { PanelShell, type PanelStatusTone } from "@/components/panel/PanelShell";
import { OperationRunner } from "@/components/panel/OperationRunner";
import { EventLog } from "@/components/panel/EventLog";
import { AccountInfo } from "@/components/panel/AccountInfo";
import { V4LinkStore } from "./v4-store";
import { DAPP_METADATA } from "@/lib/dapp";
import { hasV4Extension, type V4Wallet } from "@/lib/v4-wallet";

const selectClass =
	"rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring";

function toneOf(status: string): PanelStatusTone {
	if (status === "connected") return "connected";
	if (status === "error") return "error";
	if (status === "connecting") return "pending";
	return "idle";
}

export const V4Panel = observer(function V4Panel() {
	const store = useMemo(() => new V4LinkStore(DAPP_METADATA.name), []);
	useEffect(() => () => store.dispose(), [store]);
	// The extension injects its v1-v4 socket before the page's scripts run. Read it after mount so
	// the server-rendered markup and the first client render agree; it is the default when present.
	const [extensionPresent, setExtensionPresent] = useState(false);
	useEffect(() => {
		const present = hasV4Extension();
		setExtensionPresent(present);
		if (present) {
			store.setWallet("extension");
		}
	}, [store]);

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
				) : store.status === "connecting" ? (
					<Button variant="outline" size="sm" onClick={() => store.cancel()}>
						Cancel
					</Button>
				) : (
					<Button variant="outline" size="sm" onClick={() => store.connect()}>
						Connect wallet
					</Button>
				)
			}
		>
			<div className="grid gap-5 lg:grid-cols-2">
				<div className="space-y-4">
					<label className="block text-xs">
						<span className="mb-1 block text-muted-foreground">Wallet</span>
						<select
							className={selectClass}
							value={store.wallet}
							disabled={store.connected || store.status === "connecting"}
							onChange={(e) => store.setWallet(e.target.value as V4Wallet)}
						>
							<option value="extension" disabled={!extensionPresent}>
								{extensionPresent ? "Extension (browser wallet)" : "Extension (no wallet extension detected)"}
							</option>
							<option value="desktop">Desktop (localhost:7090)</option>
						</select>
					</label>
					<AccountInfo address={store.address} />
					<OperationRunner
						disabled={!store.connected}
						busyOp={store.busyOp}
						onGetChains={() => void store.getChains()}
						onSignMessage={(m) => void store.signMessage(m)}
						onSendTokens={(to, amount, token, format) =>
							void store.sendTokens(to, amount, token, format)
						}
					/>
				</div>
				<EventLog logs={store.logs} onClear={() => store.clearLogs()} />
			</div>
		</PanelShell>
	);
});
