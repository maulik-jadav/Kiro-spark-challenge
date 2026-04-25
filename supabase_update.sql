-- ============================================================
-- PathFinder: Update SQL — run in Supabase SQL Editor
-- Fixes green_mode logic + adds 15 users + leaderboard view
-- ============================================================

-- Fix Alex Rivera's trips with correct green mode logic:
-- cycling only if distance < 7 miles (11.27 km)
-- walking only if distance < 2 miles (3.22 km)
UPDATE public.trips SET
  green_mode = CASE
    WHEN total_distance_km < 3.22  THEN 'walking'
    WHEN total_distance_km < 11.27 THEN 'bicycling'
    ELSE green_mode
  END,
  green_emissions_kg = CASE
    WHEN total_distance_km < 3.22  THEN 0.000
    WHEN total_distance_km < 11.27 THEN 0.000
    ELSE green_emissions_kg
  END,
  green_cost_usd = CASE
    WHEN total_distance_km < 3.22  THEN 0.00
    WHEN total_distance_km < 11.27 THEN 0.00
    ELSE green_cost_usd
  END,
  savings_vs_driving_kg = CASE
    WHEN total_distance_km < 3.22  THEN total_emissions_kg
    WHEN total_distance_km < 11.27 THEN total_emissions_kg
    ELSE savings_vs_driving_kg
  END
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ============================================================
-- Add 15 new synthetic users
-- ============================================================
INSERT INTO public.users (id, name, email) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'Maya Chen',       'maya.chen@example.com'),
  ('b1000001-0000-0000-0000-000000000002', 'Jordan Smith',    'jordan.smith@example.com'),
  ('b1000001-0000-0000-0000-000000000003', 'Priya Patel',     'priya.patel@example.com'),
  ('b1000001-0000-0000-0000-000000000004', 'Carlos Mendez',   'carlos.mendez@example.com'),
  ('b1000001-0000-0000-0000-000000000005', 'Aisha Johnson',   'aisha.johnson@example.com'),
  ('b1000001-0000-0000-0000-000000000006', 'Liam O''Brien',   'liam.obrien@example.com'),
  ('b1000001-0000-0000-0000-000000000007', 'Sofia Rossi',     'sofia.rossi@example.com'),
  ('b1000001-0000-0000-0000-000000000008', 'Ethan Park',      'ethan.park@example.com'),
  ('b1000001-0000-0000-0000-000000000009', 'Fatima Al-Hassan','fatima.alhassan@example.com'),
  ('b1000001-0000-0000-0000-000000000010', 'Noah Williams',   'noah.williams@example.com'),
  ('b1000001-0000-0000-0000-000000000011', 'Zoe Martinez',    'zoe.martinez@example.com'),
  ('b1000001-0000-0000-0000-000000000012', 'Kai Nakamura',    'kai.nakamura@example.com'),
  ('b1000001-0000-0000-0000-000000000013', 'Amara Osei',      'amara.osei@example.com'),
  ('b1000001-0000-0000-0000-000000000014', 'Lucas Dubois',    'lucas.dubois@example.com'),
  ('b1000001-0000-0000-0000-000000000015', 'Isla MacLeod',    'isla.macleod@example.com')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Trips for new users (green_mode respects distance rules)
-- ============================================================
INSERT INTO public.trips (user_id, origin, destination, chosen_mode, total_distance_km, total_duration_min, total_emissions_kg, total_cost_usd, green_emissions_kg, green_cost_usd, green_mode, savings_vs_driving_kg, trip_date) VALUES

-- Maya Chen (mostly green — cyclist/walker)
('b1000001-0000-0000-0000-000000000001','Mission District, SF','Castro, SF','walking',2.1,26,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '28 days'),
('b1000001-0000-0000-0000-000000000001','Castro, SF','Noe Valley, SF','bicycling',3.5,14,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '21 days'),
('b1000001-0000-0000-0000-000000000001','San Francisco, CA','Oakland, CA','subway',18.4,35,0.552,2.50,0.552,2.50,'subway',0.000, now()-interval '14 days'),
('b1000001-0000-0000-0000-000000000001','Oakland, CA','Berkeley, CA','bicycling',8.2,32,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '7 days'),
('b1000001-0000-0000-0000-000000000001','SF Caltrain','Downtown SF','walking',1.8,22,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '2 days'),

-- Jordan Smith (heavy driver)
('b1000001-0000-0000-0000-000000000002','San Francisco, CA','San Jose, CA','driving',80.5,75,14.490,12.00,0.805,6.00,'commuter_rail',13.685, now()-interval '29 days'),
('b1000001-0000-0000-0000-000000000002','San Jose, CA','Santa Cruz, CA','driving',55.2,58,9.936,8.50,0.552,8.50,'commuter_rail',9.384, now()-interval '22 days'),
('b1000001-0000-0000-0000-000000000002','San Francisco, CA','Sacramento, CA','driving',140.2,110,25.236,20.00,1.402,15.00,'commuter_rail',23.834, now()-interval '15 days'),
('b1000001-0000-0000-0000-000000000002','Sacramento, CA','San Francisco, CA','driving',140.2,108,25.236,20.00,1.402,15.00,'commuter_rail',23.834, now()-interval '14 days'),
('b1000001-0000-0000-0000-000000000002','San Francisco, CA','Palo Alto, CA','driving',55.0,52,9.900,8.00,0.550,6.00,'commuter_rail',9.350, now()-interval '5 days'),

-- Priya Patel (transit user)
('b1000001-0000-0000-0000-000000000003','Downtown SF','SFO Airport','subway',22.1,40,0.663,3.50,0.663,3.50,'subway',0.000, now()-interval '27 days'),
('b1000001-0000-0000-0000-000000000003','SFO Airport','Downtown SF','subway',22.1,40,0.663,3.50,0.663,3.50,'subway',0.000, now()-interval '20 days'),
('b1000001-0000-0000-0000-000000000003','SF Caltrain','Palo Alto Caltrain','commuter_rail',48.0,55,0.960,8.00,0.960,8.00,'commuter_rail',0.000, now()-interval '13 days'),
('b1000001-0000-0000-0000-000000000003','Mission District, SF','Haight, SF','bicycling',4.2,17,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '6 days'),
('b1000001-0000-0000-0000-000000000003','Haight, SF','Mission District, SF','walking',2.8,35,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '1 days'),

-- Carlos Mendez (rideshare heavy)
('b1000001-0000-0000-0000-000000000004','SFO Airport','Union Square, SF','rideshare',22.1,38,4.420,28.00,0.000,0.00,'bicycling',4.420, now()-interval '26 days'),
('b1000001-0000-0000-0000-000000000004','Union Square, SF','Fishermans Wharf, SF','rideshare',5.5,18,1.100,14.00,0.000,0.00,'bicycling',1.100, now()-interval '19 days'),
('b1000001-0000-0000-0000-000000000004','Fishermans Wharf, SF','SFO Airport','rideshare',22.1,42,4.420,30.00,0.000,0.00,'bicycling',4.420, now()-interval '12 days'),
('b1000001-0000-0000-0000-000000000004','San Francisco, CA','Oakland, CA','rideshare',18.4,35,3.680,22.00,0.000,0.00,'bicycling',3.680, now()-interval '5 days'),
('b1000001-0000-0000-0000-000000000004','Oakland, CA','San Francisco, CA','bus',18.4,45,0.552,3.50,0.552,3.50,'bus',0.000, now()-interval '2 days'),

-- Aisha Johnson (eco champion)
('b1000001-0000-0000-0000-000000000005','Tenderloin, SF','Civic Center, SF','walking',1.2,15,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '30 days'),
('b1000001-0000-0000-0000-000000000005','Civic Center, SF','Mission District, SF','bicycling',4.8,19,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '23 days'),
('b1000001-0000-0000-0000-000000000005','Mission District, SF','Dogpatch, SF','bicycling',5.5,22,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '16 days'),
('b1000001-0000-0000-0000-000000000005','Dogpatch, SF','Downtown SF','bicycling',6.8,27,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '9 days'),
('b1000001-0000-0000-0000-000000000005','Downtown SF','Tenderloin, SF','walking',1.5,18,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '3 days'),

-- Liam O'Brien (mixed)
('b1000001-0000-0000-0000-000000000006','Berkeley, CA','San Francisco, CA','bus',24.6,50,0.738,3.50,0.738,3.50,'bus',0.000, now()-interval '28 days'),
('b1000001-0000-0000-0000-000000000006','San Francisco, CA','Berkeley, CA','carpool_2',24.6,42,2.214,5.50,0.246,3.50,'subway',1.968, now()-interval '21 days'),
('b1000001-0000-0000-0000-000000000006','Berkeley, CA','Oakland, CA','bicycling',8.0,31,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '14 days'),
('b1000001-0000-0000-0000-000000000006','Oakland, CA','San Jose, CA','commuter_rail',72.0,65,1.440,12.00,1.440,12.00,'commuter_rail',0.000, now()-interval '7 days'),
('b1000001-0000-0000-0000-000000000006','San Jose, CA','Berkeley, CA','driving',80.5,78,14.490,12.00,0.805,6.00,'commuter_rail',13.685, now()-interval '1 days'),

-- Sofia Rossi (light rail + walking)
('b1000001-0000-0000-0000-000000000007','San Jose, CA','Santa Clara, CA','light_rail',12.3,25,0.369,3.50,0.000,0.00,'bicycling',0.369, now()-interval '27 days'),
('b1000001-0000-0000-0000-000000000007','Santa Clara, CA','Sunnyvale, CA','light_rail',8.5,18,0.255,2.50,0.000,0.00,'bicycling',0.255, now()-interval '20 days'),
('b1000001-0000-0000-0000-000000000007','Sunnyvale, CA','Mountain View, CA','bicycling',7.2,29,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '13 days'),
('b1000001-0000-0000-0000-000000000007','Mountain View, CA','Palo Alto, CA','walking',2.5,31,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '6 days'),
('b1000001-0000-0000-0000-000000000007','Palo Alto, CA','San Jose, CA','commuter_rail',32.0,38,0.640,5.50,0.640,5.50,'commuter_rail',0.000, now()-interval '1 days'),

-- Ethan Park (carpool commuter)
('b1000001-0000-0000-0000-000000000008','San Francisco, CA','San Jose, CA','carpool_4',80.5,80,3.622,4.00,0.805,6.00,'commuter_rail',2.817, now()-interval '25 days'),
('b1000001-0000-0000-0000-000000000008','San Jose, CA','San Francisco, CA','carpool_4',80.5,82,3.622,4.00,0.805,6.00,'commuter_rail',2.817, now()-interval '18 days'),
('b1000001-0000-0000-0000-000000000008','San Francisco, CA','San Jose, CA','carpool_2',80.5,78,7.245,6.00,0.805,6.00,'commuter_rail',6.440, now()-interval '11 days'),
('b1000001-0000-0000-0000-000000000008','San Jose, CA','San Francisco, CA','carpool_2',80.5,80,7.245,6.00,0.805,6.00,'commuter_rail',6.440, now()-interval '4 days'),
('b1000001-0000-0000-0000-000000000008','Downtown SF','Mission District, SF','walking',2.9,36,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '1 days'),

-- Fatima Al-Hassan (bus + subway)
('b1000001-0000-0000-0000-000000000009','Oakland, CA','San Francisco, CA','subway',18.4,32,0.552,2.50,0.552,2.50,'subway',0.000, now()-interval '29 days'),
('b1000001-0000-0000-0000-000000000009','San Francisco, CA','Daly City, CA','subway',14.5,28,0.435,2.50,0.435,2.50,'subway',0.000, now()-interval '22 days'),
('b1000001-0000-0000-0000-000000000009','Daly City, CA','San Francisco, CA','bus',14.5,35,0.435,2.50,0.435,2.50,'bus',0.000, now()-interval '15 days'),
('b1000001-0000-0000-0000-000000000009','San Francisco, CA','Oakland, CA','driving',18.4,30,3.312,4.50,0.000,0.00,'bicycling',3.312, now()-interval '8 days'),
('b1000001-0000-0000-0000-000000000009','Oakland, CA','Berkeley, CA','bicycling',8.2,32,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '2 days'),

-- Noah Williams (e-scooter + rideshare)
('b1000001-0000-0000-0000-000000000010','Downtown SF','Embarcadero, SF','e_scooter',3.2,12,0.064,4.00,0.000,0.00,'bicycling',0.064, now()-interval '26 days'),
('b1000001-0000-0000-0000-000000000010','Embarcadero, SF','Mission District, SF','e_scooter',5.8,22,0.116,6.00,0.000,0.00,'bicycling',0.116, now()-interval '19 days'),
('b1000001-0000-0000-0000-000000000010','Mission District, SF','SFO Airport','rideshare',22.1,40,4.420,26.00,0.000,0.00,'bicycling',4.420, now()-interval '12 days'),
('b1000001-0000-0000-0000-000000000010','SFO Airport','Downtown SF','subway',22.1,38,0.663,3.50,0.663,3.50,'subway',0.000, now()-interval '5 days'),
('b1000001-0000-0000-0000-000000000010','Downtown SF','Castro, SF','e_scooter',4.5,17,0.090,5.00,0.000,0.00,'bicycling',0.090, now()-interval '1 days'),

-- Zoe Martinez (mostly green)
('b1000001-0000-0000-0000-000000000011','Haight, SF','Golden Gate Park, SF','walking',1.9,24,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '28 days'),
('b1000001-0000-0000-0000-000000000011','Golden Gate Park, SF','Richmond, SF','bicycling',3.8,15,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '21 days'),
('b1000001-0000-0000-0000-000000000011','Richmond, SF','Downtown SF','bus',9.5,30,0.285,2.50,0.285,2.50,'bus',0.000, now()-interval '14 days'),
('b1000001-0000-0000-0000-000000000011','Downtown SF','Oakland, CA','subway',18.4,35,0.552,2.50,0.552,2.50,'subway',0.000, now()-interval '7 days'),
('b1000001-0000-0000-0000-000000000011','Oakland, CA','Haight, SF','bus',20.5,55,0.615,3.50,0.615,3.50,'bus',0.000, now()-interval '2 days'),

-- Kai Nakamura (mixed, moderate)
('b1000001-0000-0000-0000-000000000012','Japantown, SF','Civic Center, SF','walking',2.2,27,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '27 days'),
('b1000001-0000-0000-0000-000000000012','Civic Center, SF','SFO Airport','driving',22.1,35,3.978,5.00,0.000,0.00,'bicycling',3.978, now()-interval '20 days'),
('b1000001-0000-0000-0000-000000000012','SFO Airport','Japantown, SF','subway',22.1,42,0.663,3.50,0.663,3.50,'subway',0.000, now()-interval '13 days'),
('b1000001-0000-0000-0000-000000000012','Japantown, SF','Haight, SF','bicycling',4.0,16,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '6 days'),
('b1000001-0000-0000-0000-000000000012','Haight, SF','Japantown, SF','driving',4.0,12,0.720,2.00,0.000,0.00,'bicycling',0.720, now()-interval '1 days'),

-- Amara Osei (commuter rail fan)
('b1000001-0000-0000-0000-000000000013','San Francisco, CA','San Jose, CA','commuter_rail',80.5,65,1.610,8.00,1.610,8.00,'commuter_rail',0.000, now()-interval '30 days'),
('b1000001-0000-0000-0000-000000000013','San Jose, CA','San Francisco, CA','commuter_rail',80.5,65,1.610,8.00,1.610,8.00,'commuter_rail',0.000, now()-interval '23 days'),
('b1000001-0000-0000-0000-000000000013','San Francisco, CA','Palo Alto, CA','commuter_rail',48.0,45,0.960,6.50,0.960,6.50,'commuter_rail',0.000, now()-interval '16 days'),
('b1000001-0000-0000-0000-000000000013','Palo Alto, CA','San Francisco, CA','commuter_rail',48.0,45,0.960,6.50,0.960,6.50,'commuter_rail',0.000, now()-interval '9 days'),
('b1000001-0000-0000-0000-000000000013','Downtown SF','Mission District, SF','bicycling',5.2,21,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '3 days'),

-- Lucas Dubois (high emissions)
('b1000001-0000-0000-0000-000000000014','San Francisco, CA','Los Angeles, CA','driving',600.0,380,108.000,80.00,6.000,50.00,'commuter_rail',102.000, now()-interval '25 days'),
('b1000001-0000-0000-0000-000000000014','Los Angeles, CA','San Francisco, CA','driving',600.0,375,108.000,80.00,6.000,50.00,'commuter_rail',102.000, now()-interval '18 days'),
('b1000001-0000-0000-0000-000000000014','San Francisco, CA','Sacramento, CA','driving',140.2,105,25.236,18.00,1.402,15.00,'commuter_rail',23.834, now()-interval '11 days'),
('b1000001-0000-0000-0000-000000000014','Sacramento, CA','San Francisco, CA','driving',140.2,108,25.236,18.00,1.402,15.00,'commuter_rail',23.834, now()-interval '4 days'),
('b1000001-0000-0000-0000-000000000014','Downtown SF','SFO Airport','rideshare',22.1,38,4.420,28.00,0.000,0.00,'bicycling',4.420, now()-interval '1 days'),

-- Isla MacLeod (balanced)
('b1000001-0000-0000-0000-000000000015','Edinburgh Old Town','Edinburgh New Town','walking',1.5,18,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '29 days'),
('b1000001-0000-0000-0000-000000000015','Edinburgh, UK','Glasgow, UK','commuter_rail',80.0,55,1.600,12.00,1.600,12.00,'commuter_rail',0.000, now()-interval '22 days'),
('b1000001-0000-0000-0000-000000000015','Glasgow, UK','Edinburgh, UK','bus',80.0,90,2.400,8.00,1.600,12.00,'commuter_rail',0.800, now()-interval '15 days'),
('b1000001-0000-0000-0000-000000000015','Edinburgh Old Town','Leith, Edinburgh','bicycling',5.5,22,0.000,0.00,0.000,0.00,'bicycling',0.000, now()-interval '8 days'),
('b1000001-0000-0000-0000-000000000015','Leith, Edinburgh','Edinburgh Old Town','walking',2.0,25,0.000,0.00,0.000,0.00,'walking',0.000, now()-interval '2 days')

ON CONFLICT DO NOTHING;

-- ============================================================
-- Leaderboard view: kg CO2 per km (lower = greener)
-- ============================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  u.id,
  u.name,
  u.email,
  COUNT(t.id)                                          AS trip_count,
  ROUND(SUM(t.total_distance_km)::numeric, 2)          AS total_distance_km,
  ROUND(SUM(t.total_emissions_kg)::numeric, 4)         AS total_emissions_kg,
  ROUND(SUM(t.total_cost_usd)::numeric, 2)             AS total_cost_usd,
  ROUND(
    CASE WHEN SUM(t.total_distance_km) > 0
      THEN SUM(t.total_emissions_kg) / SUM(t.total_distance_km)
      ELSE 0
    END::numeric, 6
  )                                                    AS emissions_per_km,
  ROUND(SUM(COALESCE(t.savings_vs_driving_kg, 0))::numeric, 4) AS total_saved_kg
FROM public.users u
JOIN public.trips t ON t.user_id = u.id
GROUP BY u.id, u.name, u.email
ORDER BY emissions_per_km ASC;
