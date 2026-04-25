-- ============================================================
-- PathFinder: trips-log Supabase Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Users table (synthetic user)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Trips table
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  chosen_mode TEXT NOT NULL,
  total_distance_km NUMERIC(8,2) NOT NULL,
  total_duration_min NUMERIC(8,2) NOT NULL,
  total_emissions_kg NUMERIC(8,4) NOT NULL,
  total_cost_usd NUMERIC(8,2) NOT NULL,
  green_emissions_kg NUMERIC(8,4),   -- what it would have been on greenest path
  green_cost_usd NUMERIC(8,2),
  green_mode TEXT,
  savings_vs_driving_kg NUMERIC(8,4),
  trip_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS (allow public read for demo)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public read trips" ON public.trips FOR SELECT USING (true);

-- ============================================================
-- Seed: synthetic user
-- ============================================================
INSERT INTO public.users (id, name, email, avatar_url)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Alex Rivera',
  'alex.rivera@example.com',
  NULL
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Seed: 8 synthetic trips for Alex Rivera
-- ============================================================
INSERT INTO public.trips (user_id, origin, destination, chosen_mode, total_distance_km, total_duration_min, total_emissions_kg, total_cost_usd, green_emissions_kg, green_cost_usd, green_mode, savings_vs_driving_kg, trip_date)
VALUES
  -- Trip 1: Driving (high emissions)
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'San Francisco, CA', 'Oakland, CA',
   'driving', 18.4, 32, 3.312, 4.50,
   0.184, 2.20, 'bicycling', 3.128,
   now() - interval '30 days'),

  -- Trip 2: Subway (green)
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Mission District, SF', 'Downtown San Francisco',
   'subway', 5.2, 18, 0.156, 2.50,
   0.052, 0.00, 'walking', 0.104,
   now() - interval '27 days'),

  -- Trip 3: Bus
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'San Francisco, CA', 'San Jose, CA',
   'bus', 80.5, 95, 2.415, 6.00,
   0.805, 6.00, 'commuter_rail', 1.610,
   now() - interval '24 days'),

  -- Trip 4: Driving (long)
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'San Francisco, CA', 'Sacramento, CA',
   'driving', 140.2, 105, 25.236, 18.00,
   1.402, 15.00, 'commuter_rail', 23.834,
   now() - interval '21 days'),

  -- Trip 5: Bicycling (very green)
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Castro, SF', 'Fishermans Wharf, SF',
   'bicycling', 6.8, 28, 0.000, 0.00,
   0.000, 0.00, 'bicycling', 0.000,
   now() - interval '18 days'),

  -- Trip 6: Rideshare
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'SFO Airport', 'Union Square, SF',
   'rideshare', 22.1, 38, 4.420, 28.00,
   0.221, 2.50, 'subway', 4.199,
   now() - interval '14 days'),

  -- Trip 7: Light Rail
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'San Jose, CA', 'Santa Clara, CA',
   'light_rail', 12.3, 25, 0.369, 3.50,
   0.123, 0.00, 'bicycling', 0.246,
   now() - interval '10 days'),

  -- Trip 8: Carpool
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Berkeley, CA', 'San Francisco, CA',
   'carpool_2', 24.6, 42, 2.214, 5.50,
   0.246, 3.50, 'subway', 1.968,
   now() - interval '5 days')
ON CONFLICT DO NOTHING;
