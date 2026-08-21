import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/places/:path*",
        destination: process.env.PLACE_SERVICE_URL || "http://localhost:8082/api/places/:path*",
      },
      {
        source: "/api/:path*",
        destination: process.env.API_GATEWAY_URL || "http://localhost:8080/api/:path*",
      },
    ];
  },
};

export default nextConfig;
