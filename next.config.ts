import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  reactStrictMode: true,
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
