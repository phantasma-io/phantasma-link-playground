"use client";

import { ThemeProvider } from "next-themes";
import { PhantasmaLinkProvider } from "phantasma-link-react";
import { findInjectedProvider } from "phantasma-sdk-ts/link/v5";
import { Toaster } from "@/components/ui/sonner";
import { DAPP_METADATA } from "@/lib/dapp";

export function Providers({ children }: { children: React.ReactNode }) {
	// Spec section 3 puts the extension first when one is on the page. Without one, this
	// desktop tester starts on the cross-device relay flow. The store remembers the user's
	// own choice across reloads, so this only decides the first visit.
	const transport = findInjectedProvider() ? "injected" : "relay";
	return (
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
			<PhantasmaLinkProvider config={{ dapp: DAPP_METADATA, transport }}>
				{children}
				<Toaster />
			</PhantasmaLinkProvider>
		</ThemeProvider>
	);
}
