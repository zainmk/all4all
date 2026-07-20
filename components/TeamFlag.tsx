"use client";

import { flagUrl } from "@/lib/flags";

export function TeamFlag({
  name,
  className = "w-9 h-6",
  fallback = "flag",
}: {
  name?: string;
  className?: string;
  /** Club leagues have no meaningful flag — go straight to initials. */
  fallback?: "flag" | "initials";
}) {
  if (!name) return null;
  const url = fallback === "flag" ? flagUrl(name) : undefined;
  if (!url) {
    return (
      <div
        className={`${className} rounded flex items-center justify-center text-xs font-bold shrink-0`}
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      className={`${className} object-cover rounded shrink-0`}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}
