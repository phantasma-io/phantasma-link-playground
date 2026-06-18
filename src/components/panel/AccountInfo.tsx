"use client";

import { Copy } from "lucide-react";
import { clip_copy, type WalletInfo } from "phantasma-link-react";

export interface AccountBalance {
	symbol: string;
	amount: string;
}

export function AccountInfo({
	address,
	balances,
	wallet,
}: {
	address?: string;
	balances?: AccountBalance[];
	wallet?: WalletInfo;
}) {
	if (!address) {
		return (
			<div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
				Not connected.
			</div>
		);
	}
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-3">
			<div className="flex items-start gap-2">
				{/* Full address, never abbreviated - in this tester the exact address matters and a
				    truncated form is useless. break-all lets the long P-address wrap. */}
				<span className="font-mono text-xs break-all">{address}</span>
				<button
					type="button"
					onClick={() => clip_copy(address)}
					className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Copy address"
				>
					<Copy className="size-3.5" />
				</button>
			</div>
			{wallet ? (
				<p className="mt-1 text-xs text-muted-foreground">
					{wallet.name} v{wallet.version}
				</p>
			) : null}
			{balances && balances.length > 0 ? (
				// A funded wallet can hold dozens of tokens, so cap the height and scroll instead of
				// letting the list grow the whole panel.
				<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
					{balances.map((b) => (
						<span key={b.symbol} className="rounded bg-muted px-2 py-0.5 text-xs">
							{b.amount} {b.symbol}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
