import type { Metadata } from "next";
import { LeaguePage } from "@/components/LeaguePage";
import { LEAGUES } from "@/lib/leagues";

export const revalidate = 30;

export const metadata: Metadata = {
  title: LEAGUES.wnba.title,
  description: LEAGUES.wnba.description,
};

export default function WNBAPage() {
  return <LeaguePage leagueId="wnba" />;
}
