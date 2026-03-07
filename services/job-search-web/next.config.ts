import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "dev01.int.stortz.tech",
    "*.int.stortz.tech",
  ],
};

export default nextConfig;
