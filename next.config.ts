import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Opt-in static export (set STATIC_EXPORT=1); otherwise a standard Next build.
	output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
	images: { unoptimized: true },
	// phantasma-link-react ships React client components; transpile it through the app pipeline.
	transpilePackages: ["phantasma-link-react"],
};

export default nextConfig;
