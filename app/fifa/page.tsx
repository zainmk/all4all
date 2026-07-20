import type { Metadata } from "next";
import { LeaguePage } from "@/components/LeaguePage";
import { LEAGUES } from "@/lib/leagues";

export const revalidate = 30;

export const metadata: Metadata = {
  title: LEAGUES.fifa.title,
  description: LEAGUES.fifa.description,
};

export default function FIFAPage() {
  return <LeaguePage leagueId="fifa" />;
}
