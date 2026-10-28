import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cap how stale a cached page can be when served. By default a page past its
  // revalidate window is served stale for up to a year while it regenerates in
  // the background — so after a quiet spell the first visitor got a day-old
  // scoreboard ("Starting now" on games long finished). Past 10 minutes the page
  // is now re-rendered before it's served instead.
  expireTime: 600,
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
              "connect-src 'self' *",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
