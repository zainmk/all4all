import type { Metadata } from "next";
import { Geist, Barlow_Condensed } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const barlowCondensed = Barlow_Condensed({
  variable: "--font-sport",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  // Each league page sets its own title; this suffixes them ("WNBA · all4all")
  title: {
    template: "%s · all4all",
    default: "all4all",
  },
  description: "Watch live and upcoming games",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${barlowCondensed.variable} h-full`}>
      {/* Neutral near-black so overscroll doesn't clash with either league's gradient */}
      <body className="min-h-full antialiased" style={{ background: "#07070c" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
