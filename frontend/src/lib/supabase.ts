import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DbUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface DbTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  chosen_mode: string;
  total_distance_km: number;
  total_duration_min: number;
  total_emissions_kg: number;
  total_cost_usd: number;
  green_emissions_kg: number | null;
  green_cost_usd: number | null;
  green_mode: string | null;
  savings_vs_driving_kg: number | null;
  trip_date: string;
  created_at: string;
}

export const DEMO_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
