import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
	// `@phantasma/link-react` and `phantasma-sdk-ts` are linked via `file:` to sibling checkouts
	// (until v5 ships to npm). Point Turbopack's root at the parent directory so it is allowed to
	// resolve those symlinked packages, and transpile the local React package through the app's
	// pipeline so its client components are handled correctly.
	turbopack: { root: path.resolve(process.cwd(), "..") },
	transpilePackages: ["@phantasma/link-react"],
};

export default nextConfig;
