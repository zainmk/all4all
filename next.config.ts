import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "/" is deliberately not redirected here. The landing league now comes
  // from localStorage, which only the browser can read — a config redirect runs
  // at the edge and would pre-empt it. See app/page.tsx.
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
