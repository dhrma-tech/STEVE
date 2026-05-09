import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  reactStrictMode: true,
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
