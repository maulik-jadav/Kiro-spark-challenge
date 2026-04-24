export type TransitMode =
  | "driving"
  | "carpool_2"
  | "carpool_4"
  | "bus"
  | "light_rail"
  | "subway"
  | "commuter_rail"
  | "walking"
  | "bicycling"
  | "e_scooter"
  | "rideshare";

export const ALL_MODES: TransitMode[] = [
  "driving",
  "carpool_2",
  "carpool_4",
  "bus",
  "light_rail",
  "subway",
  "commuter_rail",
  "walking",
  "bicycling",
  "e_scooter",
  "rideshare",
];

export const MODE_LABELS: Record<TransitMode, string> = {
  driving: "Driving",
  carpool_2: "Carpool (2)",
  carpool_4: "Carpool (4)",
  bus: "Bus",
  light_rail: "Light Rail",
  subway: "Subway",
  commuter_rail: "Commuter Rail",
  walking: "Walking",
  bicycling: "Bicycling",
  e_scooter: "E-Scooter",
  rideshare: "Rideshare",
};

export interface RouteSegment {
  mode: TransitMode;
  distance_km: number;
  duration_min: number;
  emissions_g: number;
  cost_usd: number;
  description: string;
}

export interface RouteOption {
  mode: TransitMode;
  segments: RouteSegment[];
  total_distance_km: number;
  total_duration_min: number;
  total_emissions_g: number;
  total_emissions_kg: number;
  total_cost_usd: number;
  emission_factor_source: string;
  cost_source: string;
}

export interface RouteComparison {
  origin: string;
  destination: string;
  options: RouteOption[];
  greenest: RouteOption | null;
  fastest: RouteOption | null;
  cheapest: RouteOption | null;
  savings_vs_driving_kg: number | null;
}
