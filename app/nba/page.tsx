import type { Metadata } from "next";
import { LeaguePage } from "@/components/LeaguePage";
import { LEAGUES } from "@/lib/leagues";

export const revalidate = 30;

export const metadata: Metadata = {
  title: LEAGUES.nba.title,
  description: LEAGUES.nba.description,
};

export default function NBAPage() {
  return <LeaguePage leagueId="nba" />;
}
