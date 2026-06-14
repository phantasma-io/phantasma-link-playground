"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
	"w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

export interface OperationRunnerProps {
	disabled: boolean;
	/** Label of the in-flight operation, so the matching button shows a spinner. */
	busyOp?: string;
	onGetChains: () => void;
	onGetWalletInfo?: () => void;
	onSignMessage: (message: string) => void;
	onTransferSoul: (to: string, amount: string, format: "script" | "carbon", tokenId: string) => void;
}

export function OperationRunner({
	disabled,
	busyOp,
	onGetChains,
	onGetWalletInfo,
	onSignMessage,
	onTransferSoul,
}: OperationRunnerProps) {
	const [message, setMessage] = useState("Hello from the Phantasma Link Playground");
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("0.05");
	const [format, setFormat] = useState<"script" | "carbon">("script");
	const [tokenId, setTokenId] = useState("1");

	const anyBusy = !!busyOp;
	const busy = (...labels: string[]) => labels.includes(busyOp ?? "");

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Button size="sm" variant="secondary" disabled={disabled || anyBusy} onClick={onGetChains}>
					{busy("getChains", "getNexus") ? "..." : "Get chains"}
				</Button>
				{onGetWalletInfo ? (
					<Button size="sm" variant="secondary" disabled={disabled || anyBusy} onClick={onGetWalletInfo}>
						{busy("getWalletInfo") ? "..." : "Get wallet info"}
					</Button>
				) : null}
			</div>

			<div className="space-y-2">
				<span className="text-xs font-medium text-muted-foreground">Sign message</span>
				<input
					className={inputClass}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Message to sign"
				/>
				<Button size="sm" disabled={disabled || anyBusy || !message.trim()} onClick={() => onSignMessage(message)}>
					{busy("signMessage", "signData") ? "Signing..." : "Sign message"}
				</Button>
			</div>

			<div className="space-y-2">
				<span className="text-xs font-medium text-muted-foreground">Send SOUL</span>
				<input
					className={inputClass}
					value={recipient}
					onChange={(e) => setRecipient(e.target.value)}
					placeholder="Recipient address (P...)"
				/>
				<div className="flex flex-wrap items-center gap-2">
					<input
						className={cn(inputClass, "w-24")}
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder="0.05"
						inputMode="decimal"
					/>
					<select
						className={cn(inputClass, "w-auto")}
						value={format}
						onChange={(e) => setFormat(e.target.value as "script" | "carbon")}
						aria-label="Transaction format"
					>
						<option value="script">Script (VM)</option>
						<option value="carbon">Carbon</option>
					</select>
					{format === "carbon" ? (
						<input
							className={cn(inputClass, "w-24")}
							value={tokenId}
							onChange={(e) => setTokenId(e.target.value)}
							placeholder="token id"
							inputMode="numeric"
							aria-label="Carbon token id"
						/>
					) : null}
					<Button
						size="sm"
						disabled={
							disabled ||
							anyBusy ||
							!recipient.trim() ||
							!amount.trim() ||
							(format === "carbon" && !tokenId.trim())
						}
						onClick={() => onTransferSoul(recipient, amount, format, tokenId)}
					>
						{busy("sendTransaction", "signTx", "signCarbonTx") ? "Sending..." : "Send SOUL"}
					</Button>
				</div>
			</div>
		</div>
	);
}
