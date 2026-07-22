import type { Metadata } from "next";
import { RacePage } from "@/components/RacePage";
import { LEAGUES } from "@/lib/leagues";

export const revalidate = 300;

export const metadata: Metadata = {
  title: LEAGUES.f1.title,
  description: LEAGUES.f1.description,
};

export default function F1Page() {
  return <RacePage leagueId="f1" />;
}
