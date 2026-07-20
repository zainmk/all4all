import type { Metadata } from "next";
import { RacePage } from "@/components/RacePage";
import { LEAGUES } from "@/lib/leagues";

export const revalidate = 300;

export const metadata: Metadata = {
  title: LEAGUES.motogp.title,
  description: LEAGUES.motogp.description,
};

export default function MotoGPPage() {
  return <RacePage leagueId="motogp" />;
}
