"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import EarthGlobe from "@/components/EarthGlobe";
import AuthGuard from "@/components/AuthGuard";
import { supabase, type DbTrip, DEMO_USER_ID } from "@/lib/supabase";

const MODE_ICONS: Record<string, string> = {
  driving: "directions_car",
  carpool_2: "group",
  carpool_4: "groups",
  bus: "directions_bus",
  light_rail: "tram",
  subway: "subway",
  commuter_rail: "train",
  walking: "directions_walk",
  bicycling: "pedal_bike",
  e_scooter: "electric_scooter",
  rideshare: "local_taxi",
};

const MODE_LABELS: Record<string, string> = {
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

function emissionColor(kg: number) {
  if (kg === 0) return "text-secondary";
  if (kg < 0.5) return "text-secondary";
  if (kg < 2) return "text-tertiary";
  return "text-error";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TravelHistoryPage() {
  return (
    <AuthGuard>
      <TravelHistoryContent />
    </AuthGuard>
  );
}

function TravelHistoryContent() {
  const [trips, setTrips] = useState<DbTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrips() {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", DEMO_USER_ID)
        .order("trip_date", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setTrips(data ?? []);
      }
      setLoading(false);
    }
    fetchTrips();
  }, []);

  const totalEmissions = trips.reduce((s, t) => s + t.total_emissions_kg, 0);
  const totalSaved = trips.reduce((s, t) => s + (t.savings_vs_driving_kg ?? 0), 0);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile TopAppBar */}
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest/80 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-outline-variant lg:hidden"
      >
        <div className="flex items-center gap-3">
          <EarthGlobe size={32} />
          <span className="text-xl font-headline font-bold tracking-tighter text-tertiary">PathFinder</span>
        </div>
        <span className="material-symbols-outlined text-outline cursor-pointer">account_circle</span>
      </motion.header>

      {/* Desktop SideNav */}
      <motion.nav
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="hidden lg:flex flex-col h-full pt-8 pb-8 px-4 fixed left-0 w-sidebar_width border-r border-outline-variant bg-surface-container-lowest z-40 overflow-y-auto"
      >
        <div className="mb-8 px-4 flex items-center gap-4">
          <EarthGlobe size={56} />
          <div>
            <h1 className="font-headline font-bold text-3xl text-tertiary tracking-tighter">PathFinder</h1>
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest mt-1">Eco Route Intelligence</p>
          </div>
        </div>
        <ul className="flex-1 space-y-1">
          <li>
            <Link className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="/">
              <span className="material-symbols-outlined">search</span><span>Search</span>
            </Link>
          </li>
          <li>
            <Link className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="/plan-day">
              <span className="material-symbols-outlined">calendar_today</span><span>Plan Day</span>
            </Link>
          </li>
          <li>
            <Link className="flex items-center gap-4 px-4 py-3 rounded bg-tertiary-container/10 text-tertiary border-l-[3px] border-tertiary font-semibold text-xs uppercase tracking-widest" href="/travel-history">
              <span className="material-symbols-outlined">history</span><span>Travel History</span>
            </Link>
          </li>
          <li>
            <Link className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="/analytics">
              <span className="material-symbols-outlined">eco</span><span>Analytics</span>
            </Link>
          </li>
          <li>
            <Link className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="/leaderboard">
              <span className="material-symbols-outlined">leaderboard</span><span>Leaderboard</span>
            </Link>
          </li>
        </ul>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest mt-4"
        >
          <span className="material-symbols-outlined">logout</span><span>Sign Out</span>
        </button>
      </motion.nav>

      {/* Main */}
      <main className="flex-1 lg:pl-sidebar_width pt-16 lg:pt-0 p-md lg:p-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-headline font-bold text-2xl text-on-background">Travel History</h1>
            <p className="text-sm text-on-surface-variant mt-1">All trips taken by Alex Rivera</p>
          </div>

          {/* Summary cards */}
          {!loading && !error && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard icon="route" label="Total Trips" value={String(trips.length)} />
              <StatCard icon="co2" label="Total CO₂" value={`${totalEmissions.toFixed(2)} kg`} />
              <StatCard icon="eco" label="CO₂ Saved vs Driving" value={`${totalSaved.toFixed(2)} kg`} />
              <StatCard
                icon="attach_money"
                label="Total Spent"
                value={`$${trips.reduce((s, t) => s + t.total_cost_usd, 0).toFixed(2)}`}
              />
            </div>
          )}

          {/* Trip list */}
          {loading && (
            <div className="flex items-center justify-center h-48 text-on-surface-variant gap-3">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="material-symbols-outlined text-3xl text-tertiary"
              >
                autorenew
              </motion.span>
              <span className="text-sm">Loading trips…</span>
            </div>
          )}

          {error && (
            <div className="bg-error-container border border-error text-on-error-container rounded p-md text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && trips.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-2">
              <span className="material-symbols-outlined text-4xl text-outline-variant">history</span>
              <p>No trips found. Run the SQL setup first.</p>
            </div>
          )}

          {!loading && !error && trips.length > 0 && (
            <div className="flex flex-col gap-3">
              {trips.map((trip, i) => (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* Mode icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-2xl">
                      {MODE_ICONS[trip.chosen_mode] ?? "directions_car"}
                    </span>
                  </div>

                  {/* Route info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-on-surface truncate">{trip.origin}</span>
                      <span className="material-symbols-outlined text-outline text-base">arrow_forward</span>
                      <span className="font-semibold text-sm text-on-surface truncate">{trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                        {MODE_LABELS[trip.chosen_mode] ?? trip.chosen_mode}
                      </span>
                      <span className="text-xs text-on-surface-variant">{formatDate(trip.trip_date)}</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                    <Metric icon="straighten" label="Distance" value={`${trip.total_distance_km} km`} />
                    <Metric icon="schedule" label="Duration" value={`${trip.total_duration_min} min`} />
                    <Metric
                      icon="co2"
                      label="CO₂"
                      value={`${trip.total_emissions_kg.toFixed(3)} kg`}
                      valueClass={emissionColor(trip.total_emissions_kg)}
                    />
                    <Metric icon="attach_money" label="Cost" value={`$${trip.total_cost_usd.toFixed(2)}`} />
                  </div>

                  {/* Green savings badge */}
                  {trip.savings_vs_driving_kg != null && trip.savings_vs_driving_kg > 0 && (
                    <div className="flex-shrink-0 bg-secondary-container/30 border border-secondary text-secondary text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[13px]">eco</span>
                      Saved {trip.savings_vs_driving_kg.toFixed(2)} kg
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Mobile BottomNav */}
      <nav className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant">
        <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/">
          <span className="material-symbols-outlined mb-1">explore</span>Explore
        </Link>
        <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/plan-day">
          <span className="material-symbols-outlined mb-1">calendar_today</span>Plan Day
        </Link>
        <Link className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="/travel-history">
          <span className="material-symbols-outlined mb-1">history</span>History
        </Link>
        <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/analytics">
          <span className="material-symbols-outlined mb-1">eco</span>Analytics
        </Link>
      </nav>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
      <span className="material-symbols-outlined text-tertiary text-xl">{icon}</span>
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="font-headline font-bold text-lg text-on-surface">{value}</span>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClass = "text-on-surface",
}: {
  icon: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="material-symbols-outlined text-outline text-base">{icon}</span>
      <span className={`text-xs font-semibold ${valueClass}`}>{value}</span>
      <span className="text-[10px] text-on-surface-variant">{label}</span>
    </div>
  );
}
