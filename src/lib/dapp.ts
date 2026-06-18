import type { DappMetadata } from "phantasma-link-react";

/** dApp identity the wallet shows at consent time and binds to the session. */
export const DAPP_METADATA: DappMetadata = {
	name: "Phantasma Link Playground",
	url: "https://link-playground.phantasma.info",
	description: "Side-by-side tester for Phantasma Link v5 and v4.",
};

/** A selectable network: the nexus name goes into built transactions; the RPC is used for the
 * v4 path and for on-chain lookups/links. */
export interface NetworkPreset {
	id: string;
	label: string;
	nexus: string;
	rpc: string;
}

export const NETWORKS: NetworkPreset[] = [
	{ id: "localnet", label: "Localnet", nexus: "simnet", rpc: "http://localhost:5172/rpc" },
	{ id: "testnet", label: "Testnet", nexus: "testnet", rpc: "https://testnet.phantasma.info/rpc" },
	{ id: "mainnet", label: "Mainnet", nexus: "mainnet", rpc: "https://pharpc1.phantasma.info/rpc" },
];

export const DEFAULT_NETWORK = NETWORKS[0];
