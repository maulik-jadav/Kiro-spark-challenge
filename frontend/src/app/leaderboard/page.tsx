"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import EarthGlobe from "@/components/EarthGlobe";
import AuthGuard from "@/components/AuthGuard";
import SideNav from "@/components/SideNav";
import { supabase } from "@/lib/supabase";

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  trip_count: number;
  total_distance_km: number;
  total_emissions_kg: number;
  total_cost_usd: number;
  emissions_per_km: number;
  total_saved_kg: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

function getRankColor(rank: number) {
  if (rank === 0) return "border-yellow-400 bg-yellow-50/10";
  if (rank === 1) return "border-slate-400 bg-slate-50/10";
  if (rank === 2) return "border-amber-600 bg-amber-50/10";
  return "border-outline-variant bg-surface-container-lowest";
}

function getEmissionBadge(epk: number) {
  if (epk === 0) return { label: "Zero Emission", color: "text-secondary bg-secondary-container/30 border-secondary/40" };
  if (epk < 0.01) return { label: "Eco Hero", color: "text-secondary bg-secondary-container/30 border-secondary/40" };
  if (epk < 0.05) return { label: "Green Rider", color: "text-tertiary bg-tertiary-container/20 border-tertiary/40" };
  if (epk < 0.15) return { label: "Moderate", color: "text-on-surface-variant bg-surface-variant border-outline-variant" };
  return { label: "High Impact", color: "text-error bg-error-container/30 border-error/40" };
}

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <LeaderboardContent />
    </AuthGuard>
  );
}

function LeaderboardContent() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserEmail(data.session?.user?.email ?? null);
    });

    async function fetchLeaderboard() {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("emissions_per_km", { ascending: true });

      if (error) setError(error.message);
      else setEntries(data ?? []);
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

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
          <span className="text-xl font-headline font-bold tracking-tighter text-tertiary">ECOpath</span>
        </div>
        <button onClick={handleSignOut} className="material-symbols-outlined text-outline cursor-pointer">logout</button>
      </motion.header>

      {/* Desktop SideNav */}
      <SideNav />

      {/* Main */}
      <main
        className="flex-1 pt-16 lg:pt-0 p-md lg:p-lg transition-all duration-300"
        style={{ paddingLeft: "var(--sidenav-w, 0px)" } as React.CSSProperties}
      >
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-3xl mx-auto pt-8">
          <div className="mb-6">
            <h1 className="font-headline font-bold text-2xl text-on-background">Leaderboard</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Ranked by kg CO₂ per km — lowest emissions per distance travelled wins
            </p>
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
              <span className="text-sm">Loading leaderboard…</span>
            </div>
          )}

          {error && (
            <div className="bg-error-container border border-error text-on-error-container rounded p-md text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && (
            <div className="flex flex-col gap-3">
              {entries.map((entry, i) => {
                const badge = getEmissionBadge(Number(entry.emissions_per_km));
                const isCurrentUser = entry.email === currentUserEmail;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={`border-2 rounded-xl p-4 flex items-center gap-4 ${getRankColor(i)} ${
                      isCurrentUser ? "ring-2 ring-tertiary" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 text-center">
                      {i < 3 ? (
                        <span className="text-2xl">{MEDAL[i]}</span>
                      ) : (
                        <span className="font-headline font-bold text-lg text-on-surface-variant">#{i + 1}</span>
                      )}
                    </div>

                    {/* Avatar placeholder */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-tertiary-container/30 flex items-center justify-center">
                      <span className="font-bold text-tertiary text-sm">
                        {entry.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>

                    {/* Name + badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-on-surface">{entry.name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold text-tertiary bg-tertiary-container/30 px-2 py-0.5 rounded-full border border-tertiary/30">
                            YOU
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {entry.trip_count} trips · {entry.total_distance_km} km total
                      </p>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 text-right">
                      <p className="font-headline font-bold text-lg text-on-surface">
                        {Number(entry.emissions_per_km) === 0
                          ? "0"
                          : Number(entry.emissions_per_km).toFixed(4)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">kg CO₂/km</p>
                    </div>

                    {/* Saved */}
                    {Number(entry.total_saved_kg) > 0 && (
                      <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-secondary text-xs font-semibold bg-secondary-container/20 border border-secondary/30 px-2 py-1 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">eco</span>
                        {Number(entry.total_saved_kg).toFixed(1)} kg saved
                      </div>
                    )}
                  </motion.div>
                );
              })}
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
        <Link className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="/leaderboard">
          <span className="material-symbols-outlined mb-1">leaderboard</span>Board
        </Link>
        <Link className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/analytics">
          <span className="material-symbols-outlined mb-1">eco</span>Analytics
        </Link>
      </nav>
    </div>
  );
}
