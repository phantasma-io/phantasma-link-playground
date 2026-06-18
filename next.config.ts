import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// phantasma-link-react ships React client components; transpile it through the app pipeline.
	transpilePackages: ["phantasma-link-react"],
};

export default nextConfig;
