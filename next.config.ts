import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Land on whichever league is in season. Point this at /fifa when the
      // World Cup comes back around.
      { source: "/", destination: "/wnba", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Icons are per-route (app/icon.ico, app/wnba/icon.svg) so each league gets
      // its own tab icon. Keep the conventional path working for clients that
      // probe it directly instead of reading <link rel="icon">.
      { source: "/favicon.ico", destination: "/icon.ico" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
              "style-src 'self' 'unsafe-inline' *",
              "img-src * data: blob:",
              "media-src * data: blob:",
              "frame-src *",
              "connect-src 'self' https://streamed.pk *",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
