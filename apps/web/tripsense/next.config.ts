import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.mapvina.com",
      },
      {
        protocol: "https",
        hostname: "ziomap-api.socibi.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.vietqr.io",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/hotels/bookings",
        destination: "/reservations?tab=hotels",
        permanent: true,
      },
      {
        source: "/restaurants/reservations",
        destination: "/reservations?tab=restaurants",
        permanent: true,
      },
      {
        source: "/hotels/notifications",
        destination: "/notifications",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const rawGatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:8080";
    const gatewayUrl = rawGatewayUrl.replace(/\/api(\/:path\*)?\/?$/, "").replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
