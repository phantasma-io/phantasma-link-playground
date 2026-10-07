"use client";

// The v5 signing permission demo (Link spec 1.2, 9.8). The site asks once for a permission on
// methods of one contract, and then sends calls of those methods: the wallet signs a call that
// the permission covers without a prompt and prompts for any other. The form passes plain text
// up; V5Panel builds the request and the transaction and logs what goes wrong.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatUnits } from "phantasma-sdk-ts/public";
import type { SigningPermission } from "phantasma-link-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/panel/OperationRunner";
import { cn } from "@/lib/utils";
import { CALL_GAS_COST } from "@/lib/tx";

const KCAL_DECIMALS = 10;

export interface SigningPermissionRunnerProps {
	disabled: boolean;
	/** Label of the in-flight operation, so the matching button shows a spinner. */
	busyOp?: string;
	/** The session's permission as the wallet last reported it, or undefined when there is none. */
	permission?: SigningPermission;
	/** True when the wallet has reported this session's permission, or that the session has none.
	 * After a page reload the page knows nothing until the wallet reports. */
	permissionKnown: boolean;
	onRequest: (contract: string, methods: string, minutes: string, budgetKcal: string) => void;
	onGet: () => void;
	onRevoke: () => void;
	/** Sends a transaction that calls `contract.method` with `args`, comma-separated. */
	onCall: (contract: string, method: string, args: string) => void;
}

export function SigningPermissionRunner({
	disabled,
	busyOp,
	permission,
	permissionKnown,
	onRequest,
	onGet,
	onRevoke,
	onCall,
}: SigningPermissionRunnerProps) {
	const [contract, setContract] = useState("");
	const [methods, setMethods] = useState("");
	const [minutes, setMinutes] = useState("15");
	const [budget, setBudget] = useState("5");
	const [method, setMethod] = useState("");
	const [args, setArgs] = useState("me, 1");

	const anyBusy = !!busyOp;
	const busy = (label: string) => busyOp === label;

	// The demo starts collapsed, because its fields crowd the panel. A native <details> keeps the open
	// state without React state and opens from the keyboard too.
	return (
		<details className="group rounded-lg border border-border/70 bg-background/40">
			<summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
				<ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
				Signing permission
			</summary>
			<div className="space-y-4 border-t border-border/70 p-3">
				<div className="space-y-2">
					<input
						className={inputClass}
						value={contract}
						onChange={(e) => setContract(e.target.value)}
						placeholder="Contract name"
					/>
					<input
						className={inputClass}
						value={methods}
						onChange={(e) => setMethods(e.target.value)}
						placeholder="Methods, comma-separated"
					/>
					<div className="flex flex-wrap items-center gap-2">
						<label className="flex items-center gap-1 text-xs text-muted-foreground">
							<input
								className={cn(inputClass, "w-20")}
								value={minutes}
								onChange={(e) => setMinutes(e.target.value)}
								inputMode="decimal"
								aria-label="Duration in minutes"
							/>
							min
						</label>
						<label className="flex items-center gap-1 text-xs text-muted-foreground">
							<input
								className={cn(inputClass, "w-20")}
								value={budget}
								onChange={(e) => setBudget(e.target.value)}
								inputMode="decimal"
								aria-label="Gas budget in KCAL"
							/>
							KCAL gas budget
						</label>
					</div>
					<p className="text-xs text-muted-foreground">
						Each call reserves {formatUnits(CALL_GAS_COST, KCAL_DECIMALS)} KCAL of the budget, the most it can cost. A
						budget of 0 means this account pays no gas under the permission.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							disabled={disabled || anyBusy || !contract.trim() || !methods.trim()}
							onClick={() => onRequest(contract, methods, minutes, budget)}
						>
							{busy("requestSigningPermission") ? "Requesting..." : "Request permission"}
						</Button>
						<Button size="sm" variant="secondary" disabled={disabled || anyBusy} onClick={onGet}>
							{busy("getSigningPermission") ? "..." : "Get permission"}
						</Button>
						<Button size="sm" variant="secondary" disabled={disabled || anyBusy} onClick={onRevoke}>
							{busy("revokeSigningPermission") ? "..." : "Revoke"}
						</Button>
					</div>
					<PermissionInfo permission={permission} known={permissionKnown} />
				</div>

				<div className="space-y-2">
					<span className="text-xs font-medium text-muted-foreground">Call a contract method</span>
					<div className="flex flex-wrap items-center gap-2">
						<input
							className={cn(inputClass, "w-40")}
							value={method}
							onChange={(e) => setMethod(e.target.value)}
							placeholder="Method"
						/>
						<input
							className={cn(inputClass, "w-40")}
							value={args}
							onChange={(e) => setArgs(e.target.value)}
							placeholder="Arguments"
							aria-label="Arguments"
						/>
						<Button
							size="sm"
							disabled={disabled || anyBusy || !contract.trim() || !method.trim()}
							onClick={() => onCall(contract, method, args)}
						>
							{busy("sendTransaction") ? "Sending..." : "Send call"}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						Calls the contract above. Arguments are comma-separated: <code>me</code> is your address, an address
						becomes an Address, a whole number is a Number, other text is a String.
					</p>
				</div>
			</div>
		</details>
	);
}

/** The permission in force: until when it lasts, its calls, and the gas reserved against its budget.
 * Without one it says whether the wallet reported that there is none or has not reported yet. */
function PermissionInfo({ permission, known }: { permission?: SigningPermission; known: boolean }) {
	if (!permission) {
		return (
			<div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
				{known ? "No signing permission." : "Not known yet. Get permission reads it from the wallet."}
			</div>
		);
	}
	const gas =
		permission.gasLimit === "0"
			? "This account pays no gas under it."
			: `Gas reserved: ${kcal(permission.gasReserved)} of ${kcal(permission.gasLimit)} KCAL.`;
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-3 text-xs">
			<p>
				Signs without asking until {new Date(permission.expiresAt).toLocaleTimeString()}, chain {permission.chain}.
			</p>
			{permission.calls.map((call) => (
				<p key={call.contract} className="font-mono">
					{call.contract}: {call.methods.join(", ")}
				</p>
			))}
			<p className="text-muted-foreground">{gas}</p>
		</div>
	);
}

/** Renders KCAL atoms (a decimal string) in KCAL. A value that is not a whole number is shown as the
 * wallet sent it, so a wrong value is visible instead of breaking the page. */
function kcal(atoms: string): string {
	return /^\d+$/.test(atoms) ? formatUnits(BigInt(atoms), KCAL_DECIMALS) : atoms;
}
