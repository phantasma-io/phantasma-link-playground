import { Header } from "@/components/header";
import { V5Panel } from "@/components/v5/V5Panel";
import { V4Panel } from "@/components/v4/V4Panel";

export default function Home() {
	return (
		<div className="min-h-screen">
			<Header />
			<main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
				<p className="text-sm text-muted-foreground">
					Connect a wallet to each protocol and run the same operations against it to test the
					wallet and the Link protocol - v5 (top), v4 (bottom).
				</p>
				<V5Panel />
				<V4Panel />
			</main>
		</div>
	);
}
