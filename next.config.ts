import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Cloudflare Pages serves the static export as plain files — no server
  // to run Next's image optimization API, so it's disabled here.
  images: { unoptimized: true },
};

export default nextConfig;
