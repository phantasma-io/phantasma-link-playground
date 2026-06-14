"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PanelStatusTone = "idle" | "pending" | "connected" | "error";

const TONE: Record<PanelStatusTone, string> = {
	idle: "bg-muted text-muted-foreground",
	pending: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
	connected: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	error: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export interface PanelShellProps {
	version: "v5" | "v4";
	title: string;
	subtitle: string;
	statusLabel: string;
	statusTone: PanelStatusTone;
	headerRight: ReactNode;
	children: ReactNode;
}

export function PanelShell({
	version,
	title,
	subtitle,
	statusLabel,
	statusTone,
	headerRight,
	children,
}: PanelShellProps) {
	return (
		<section className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur">
			<div className="mb-5 flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-center gap-3">
					<span
						className={cn(
							"rounded-md px-2 py-1 text-xs font-bold",
							version === "v5" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
						)}
					>
						{version.toUpperCase()}
					</span>
					<div>
						<h2 className="text-base font-semibold leading-tight">{title}</h2>
						<p className="text-xs text-muted-foreground">{subtitle}</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE[statusTone])}>
						{statusLabel}
					</span>
					{headerRight}
				</div>
			</div>
			{children}
		</section>
	);
}
