import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@smol-cafe/ui", "@smol-cafe/db"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
