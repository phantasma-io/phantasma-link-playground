"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelLogKind = "info" | "request" | "result" | "event" | "error";

export interface PanelLogEntry {
	id: string;
	ts: number;
	kind: PanelLogKind;
	label: string;
	detail?: string;
}

const KIND_STYLES: Record<PanelLogKind, string> = {
	info: "text-muted-foreground",
	request: "text-sky-500 dark:text-sky-400",
	result: "text-emerald-600 dark:text-emerald-400",
	event: "text-violet-500 dark:text-violet-400",
	error: "text-red-500 dark:text-red-400",
};

function clock(ts: number): string {
	const d = new Date(ts);
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function EventLog({ logs, onClear }: { logs: PanelLogEntry[]; onClear: () => void }) {
	return (
		<div className="flex h-full flex-col">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
					Event log
				</span>
				<button
					type="button"
					onClick={onClear}
					className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<Trash2 className="size-3.5" />
					Clear
				</button>
			</div>
			<div className="h-56 overflow-auto rounded-lg border border-border/70 bg-background/60 p-2 font-mono text-xs">
				{logs.length === 0 ? (
					<p className="p-2 text-muted-foreground">No activity yet.</p>
				) : (
					<ul className="space-y-1">
						{logs.map((entry) => (
							<li key={entry.id} className="flex gap-2">
								<span className="shrink-0 text-muted-foreground/70">{clock(entry.ts)}</span>
								<span className={cn("shrink-0 font-semibold", KIND_STYLES[entry.kind])}>{entry.label}</span>
								{entry.detail ? <span className="break-all text-muted-foreground">{entry.detail}</span> : null}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
