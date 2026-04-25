"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import EarthGlobe from "@/components/EarthGlobe";
import AuthGuard from "@/components/AuthGuard";
import SideNav from "@/components/SideNav";
import { supabase, type DbTrip, DEMO_USER_ID } from "@/lib/supabase";

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

const PIE_COLORS = ["#2d6a4f", "#52b788", "#95d5b2", "#b7e4c7", "#40916c", "#1b4332", "#74c69d", "#d8f3dc"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface LeaderboardEntry {
  id: string;
  emissions_per_km: number;
}

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <AnalyticsContent />
    </AuthGuard>
  );
}

function AnalyticsContent() {
  const [trips, setTrips] = useState<DbTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [aheadPct, setAheadPct] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      // Fetch Alex's trips
      const { data: tripData, error: tripErr } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", DEMO_USER_ID)
        .order("trip_date", { ascending: true });
      if (tripErr) { setError(tripErr.message); setLoading(false); return; }
      setTrips(tripData ?? []);

      // Fetch leaderboard to compute rank
      const { data: lb } = await supabase
        .from("leaderboard")
        .select("id,emissions_per_km")
        .order("emissions_per_km", { ascending: true });

      if (lb && lb.length > 0) {
        const total = lb.length;
        setTotalUsers(total);
        const pos = lb.findIndex((e: LeaderboardEntry) => e.id === DEMO_USER_ID);
        if (pos !== -1) {
          setRank(pos + 1);
          // % of people user is ahead of (lower rank = greener)
          setAheadPct(Math.round(((total - pos - 1) / (total - 1)) * 100));
        }
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Derived
  const totalActual = trips.reduce((s, t) => s + t.total_emissions_kg, 0);
  const totalGreen  = trips.reduce((s, t) => s + (t.green_emissions_kg ?? t.total_emissions_kg), 0);
  const totalSaved  = totalActual - totalGreen;
  const pctReduction = totalActual > 0 ? (totalSaved / totalActual) * 100 : 0;

  // Line chart: cumulative
  let cumActual = 0, cumGreen = 0;
  const lineData = trips.map((t) => {
    cumActual += t.total_emissions_kg;
    cumGreen  += t.green_emissions_kg ?? t.total_emissions_kg;
    return {
      date:   formatDate(t.trip_date),
      actual: parseFloat(cumActual.toFixed(3)),
      green:  parseFloat(cumGreen.toFixed(3)),
    };
  });

  // Pie: emissions by mode
  const modeMap: Record<string, number> = {};
  trips.forEach((t) => {
    modeMap[t.chosen_mode] = (modeMap[t.chosen_mode] ?? 0) + t.total_emissions_kg;
  });
  const pieData = Object.entries(modeMap).map(([mode, kg]) => ({
    name:  MODE_LABELS[mode] ?? mode,
    value: parseFloat(kg.toFixed(3)),
  }));

  const rankLabel = rank === 1 ? "🥇 #1" : rank === 2 ? "🥈 #2" : rank === 3 ? "🥉 #3" : rank ? `#${rank}` : "—";

  return (
    <div className="bg-background text-on-background min-h-screen flex overflow-x-hidden">
      {/* Collapsible SideNav */}
      <SideNav />

      <div className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: "var(--sidenav-width, 0)" }}>
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

        {/* Main — offset by sidebar on desktop */}
        <main className="flex-1 lg:pl-[360px] pt-16 lg:pt-0 p-md lg:p-lg">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            {/* Header row with rank badge */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h1 className="font-headline font-bold text-2xl text-on-background">Environmental Impact</h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Alex Rivera's actual footprint vs what it could have been on green paths
                </p>
              </div>
              {rank !== null && (
                <div className="flex flex-col items-center bg-tertiary-container/20 border border-tertiary/30 rounded-xl px-5 py-3 text-center flex-shrink-0">
                  <span className="text-2xl font-headline font-bold text-tertiary">{rankLabel}</span>
                  <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider mt-0.5">
                    of {totalUsers} users
                  </span>
                  <span className="text-xs text-secondary font-bold mt-1">
                    Greener than {aheadPct}% of users
                  </span>
                </div>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center h-48 text-on-surface-variant gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="material-symbols-outlined text-3xl text-tertiary"
                >
                  autorenew
                </motion.span>
                <span className="text-sm">Loading analytics…</span>
              </div>
            )}

            {error && (
              <div className="bg-error-container border border-error text-on-error-container rounded p-md text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}

            {!loading && !error && trips.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-2">
                <span className="material-symbols-outlined text-4xl text-outline-variant">eco</span>
                <p>No data yet.</p>
              </div>
            )}

            {!loading && !error && trips.length > 0 && (
              <div className="flex flex-col gap-6">
                {/* KPI row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KpiCard icon="co2"     label="Actual CO₂"        value={`${totalActual.toFixed(2)} kg`} sub="from your trips"              accent="text-error" />
                  <KpiCard icon="eco"     label="Green Path CO₂"    value={`${totalGreen.toFixed(2)} kg`}  sub="if you took greenest routes"   accent="text-secondary" />
                  <KpiCard icon="savings" label="CO₂ You Could Save" value={`${totalSaved.toFixed(2)} kg`} sub="potential reduction"           accent="text-tertiary" />
                  <KpiCard icon="percent" label="Reduction Possible" value={`${pctReduction.toFixed(0)}%`} sub="by switching to green paths"   accent="text-tertiary" />
                </div>

                {/* Line chart: cumulative */}
                <ChartCard title="Cumulative CO₂ Over Time" subtitle="kg CO₂ accumulated">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" kg" />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(v: number) => [`${v} kg CO₂`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="actual" name="Actual"      stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="green"  name="Green Path"  stroke="#52b788" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Pie + insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard title="Emissions by Transport Mode" subtitle="kg CO₂ total">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          dataKey="value"
                          label={({ name, percent }) =>
                            percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                          }
                          labelLine={true}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(v: number) => [`${v} kg CO₂`]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Insight card */}
                  <div className="bg-secondary-container/20 border border-secondary/30 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-2xl">lightbulb</span>
                      <span className="font-headline font-semibold text-on-surface">Green Path Insights</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {trips
                        .filter((t) => (t.savings_vs_driving_kg ?? 0) > 0)
                        .sort((a, b) => (b.savings_vs_driving_kg ?? 0) - (a.savings_vs_driving_kg ?? 0))
                        .slice(0, 4)
                        .map((t) => (
                          <div key={t.id} className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-secondary text-base mt-0.5">check_circle</span>
                            <p className="text-sm text-on-surface-variant">
                              <span className="font-semibold text-on-surface">
                                {t.origin.split(",")[0]} → {t.destination.split(",")[0]}:
                              </span>{" "}
                              switch to{" "}
                              <span className="text-secondary font-medium">
                                {MODE_LABELS[t.green_mode ?? ""] ?? t.green_mode}
                              </span>{" "}
                              and save{" "}
                              <span className="text-secondary font-bold">
                                {(t.savings_vs_driving_kg ?? 0).toFixed(2)} kg CO₂
                              </span>
                            </p>
                          </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-3 border-t border-secondary/20">
                      <p className="text-xs text-on-surface-variant">
                        Consistently choosing green paths could cut Alex's footprint by{" "}
                        <span className="text-secondary font-bold">{pctReduction.toFixed(0)}%</span> —{" "}
                        <span className="text-secondary font-bold">{totalSaved.toFixed(2)} kg CO₂</span> saved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </main>

        {/* Mobile BottomNav */}
        <nav className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant">
          <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/">
            <span className="material-symbols-outlined mb-1">explore</span>Explore
          </Link>
          <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/travel-history">
            <span className="material-symbols-outlined mb-1">history</span>History
          </Link>
          <Link className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="/analytics">
            <span className="material-symbols-outlined mb-1">eco</span>Analytics
          </Link>
          <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/leaderboard">
            <span className="material-symbols-outlined mb-1">leaderboard</span>Board
          </Link>
        </nav>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
      <span className={`material-symbols-outlined text-xl ${accent}`}>{icon}</span>
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className={`font-headline font-bold text-xl ${accent}`}>{value}</span>
      <span className="text-[11px] text-on-surface-variant">{sub}</span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <div className="mb-3">
        <p className="font-semibold text-sm text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
