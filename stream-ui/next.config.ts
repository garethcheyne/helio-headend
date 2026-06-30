import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // All upstream calls (TVHeadend / packager / HLS) happen server-side in
  // route handlers, so no rewrites/proxy config is needed here.
  // The DB uses Node's built-in node:sqlite (no native deps to externalise).
};

export default nextConfig;
