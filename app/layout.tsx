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
  title: "FIFA | 26",
  description: "Watch live and upcoming football matches",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${barlowCondensed.variable} h-full`}>
      <body className="min-h-full antialiased" style={{ background: "#090d1f" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
