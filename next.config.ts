import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [{ pathname: "/api/thumb" }],
  },
};

export default nextConfig;
