"use client";

import { Copy } from "lucide-react";
import { clip_copy } from "@phantasma/link-react";

export interface AccountBalance {
	symbol: string;
	amount: string;
}

function short(addr: string): string {
	return addr.length > 18 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr;
}

export function AccountInfo({ address, balances }: { address?: string; balances?: AccountBalance[] }) {
	if (!address) {
		return (
			<div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
				Not connected.
			</div>
		);
	}
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-3">
			<div className="flex items-center gap-2">
				<span className="font-mono text-sm">{short(address)}</span>
				<button
					type="button"
					onClick={() => clip_copy(address)}
					className="text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Copy address"
				>
					<Copy className="size-3.5" />
				</button>
			</div>
			{balances && balances.length > 0 ? (
				<div className="mt-2 flex flex-wrap gap-2">
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
