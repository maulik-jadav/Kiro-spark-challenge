import type { RouteComparison, TransitMode } from "@/types/api";

export async function planRoute(
  origin: string,
  destination: string,
  modes: TransitMode[] | null
): Promise<RouteComparison> {
  const res = await fetch("/api/v1/plan-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, modes }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  return res.json() as Promise<RouteComparison>;
}
