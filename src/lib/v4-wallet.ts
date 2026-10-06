// Which wallet the v4 panel talks to. The legacy client reaches a wallet extension through the
// socket the extension injects into the page, or a desktop wallet through its local socket.

/** The v4 panel's wallet: the browser extension, or the desktop wallet on localhost:7090. */
export type V4Wallet = "extension" | "desktop";

/** True when a wallet extension serves v1-v4 on this page: it defines `PhantasmaLinkSocket`. */
export function hasV4Extension(target: unknown = globalThis.window): boolean {
	return typeof (target as { PhantasmaLinkSocket?: unknown } | undefined)?.PhantasmaLinkSocket === "function";
}

/** The SDK's provider hint for a wallet, the values EasyConnect uses: "ecto" takes the
 * extension's injected socket, "poltergeist" the desktop socket. */
export function providerHintFor(wallet: V4Wallet): string {
	return wallet === "extension" ? "ecto" : "poltergeist";
}
