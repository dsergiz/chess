import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist resolves its worker via a relative import at runtime; bundling it into a
  // vendor chunk breaks that resolution, so let Node load it straight from node_modules.
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
