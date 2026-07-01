import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("sources");
  if (!param) return Response.json(null);

  const pairs = param.split(",").map((p) => {
    const colon = p.indexOf(":");
    return { source: p.slice(0, colon), id: p.slice(colon + 1) };
  });

  const results = await Promise.all(
    pairs.map(async ({ source, id }) => {
      try {
        const res = await fetch(`https://streamed.pk/api/stream/${source}/${id}`, {
          next: { revalidate: 30 },
        });
        if (!res.ok) return { source, id, viewers: 0 };
        const data = await res.json();
        if (!Array.isArray(data)) return { source, id, viewers: 0 };
        const viewers = data.reduce(
          (sum: number, s: { viewers?: number }) => sum + (s.viewers ?? 0),
          0
        );
        return { source, id, viewers };
      } catch {
        return { source, id, viewers: 0 };
      }
    })
  );

  const best = results.reduce((a, b) => (b.viewers > a.viewers ? b : a), results[0]);
  return Response.json({ best, all: results });
}
