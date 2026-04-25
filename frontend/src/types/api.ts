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
  polyline?: string | null;
}

export type Priority = "fastest" | "greenest" | "best_tradeoff";

export interface ScoredRoute extends RouteOption {
  practicality_penalty: number;
  normalized_duration: number;
  normalized_emissions: number;
  normalized_cost: number;
  final_score: number;
  is_dominated: boolean;
  explanation_reason: string;
}

export interface AgentReasoning {
  recommended_mode: TransitMode;
  summary: string;
  justification: string;
  constraint_analysis: string | null;
}

export interface RouteComparison {
  origin: string;
  destination: string;
  options: RouteOption[];
  greenest: RouteOption | null;
  fastest: RouteOption | null;
  savings_vs_driving_kg: number | null;
  reasoning: AgentReasoning | null;
  selected_priority: Priority | null;
  recommended_route: ScoredRoute | null;
  scored_routes: ScoredRoute[];
}

export interface CalendarEvent {
  summary: string;
  location: string;
  start: string;
  end: string;
}

export interface TransitRecommendation {
  mode: TransitMode;
  duration_min: number;
  emissions_g: number;
  cost_usd: number;
  summary: string;
}

export interface TransitWindow {
  from_event: string;
  to_event: string;
  origin: string;
  destination: string;
  depart_after: string;
  arrive_by: string;
  available_min: number;
  recommended: TransitRecommendation;
  route: RouteComparison;
}

export interface DayPlanRequest {
  date: string;
  session_id: string | null;
  home_address: string;
}

export interface DayPlanResponse {
  date: string;
  events: CalendarEvent[];
  transit_windows: TransitWindow[];
  total_emissions_g: number;
  total_cost_usd: number;
  total_transit_min: number;
}

// Auth types
export interface AuthUrlResponse {
  auth_url: string;
  state: string;
}

export interface AuthCallbackResponse {
  session_id: string;
  message: string;
}

// Error types
export interface ValidationErrorDetail {
  field: string;
  reason: string;
}

export interface ErrorResponse {
  status_code: number;
  message: string;
  detail: string | null;
  errors: ValidationErrorDetail[] | null;
}

// Factor types
export interface EmissionFactorResponse {
  mode: string;
  g_co2e_per_pkm: number;
  source: string;
  notes: string;
}

export interface CostFactorResponse {
  mode: string;
  base_fare: number;
  per_km_cost: number;
  source: string;
  notes: string;
}
