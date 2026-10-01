import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  reactStrictMode: true,
  // Database drivers load at runtime from node_modules instead of being bundled.
  serverExternalPackages: ["pg", "pg-boss", "@prisma/adapter-pg"],
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
