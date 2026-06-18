"use client";

import { ThemeProvider } from "next-themes";
import { PhantasmaLinkProvider } from "phantasma-link-react";
import { Toaster } from "@/components/ui/sonner";
import { DAPP_METADATA } from "@/lib/dapp";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
			<PhantasmaLinkProvider config={{ dapp: DAPP_METADATA, transport: "relay" }}>
				{children}
				<Toaster />
			</PhantasmaLinkProvider>
		</ThemeProvider>
	);
}
