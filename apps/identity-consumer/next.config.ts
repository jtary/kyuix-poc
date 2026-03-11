import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kyuix/crypto", "@kyuix/protocol"],
};

export default nextConfig;
