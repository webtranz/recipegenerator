import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STUDIO_TARGET==='node'?{output:'standalone' as const}:{}),
};

export default nextConfig;
