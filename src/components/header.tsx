import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
	return (
		<header className="border-b border-border/60 bg-card/40 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
				<div>
					<h1 className="text-lg font-semibold tracking-tight sm:text-xl">Phantasma Link Playground</h1>
					<p className="text-xs text-muted-foreground sm:text-sm">
						Test and compare v5 and v4 dApp-wallet flows side by side
					</p>
				</div>
				<ThemeToggle />
			</div>
		</header>
	);
}
