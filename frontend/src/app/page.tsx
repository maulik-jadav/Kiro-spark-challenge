"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import TripForm from "@/components/TripForm";
import ResultsPanel from "@/components/ResultsPanel";
import ReasoningPanel from "@/components/ReasoningPanel";
import MapView from "@/components/MapView";
import EarthGlobe from "@/components/EarthGlobe";
import SideNav from "@/components/SideNav";
import { planRoute } from "@/lib/api";
import type { RouteComparison, TransitMode, Priority } from "@/types/api";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteComparison | null>(null);
  const [mapOrigin, setMapOrigin] = useState<string | null>(null);
  const [mapDest, setMapDest] = useState<string | null>(null);

  async function handleSubmit(
    origin: string,
    destination: string,
    modes: TransitMode[] | null,
    constraint: string | null,
    priority: Priority
  ) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await planRoute(origin, destination, modes, constraint, priority);
      setResult(data);
      setMapOrigin(origin);
      setMapDest(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
          <span className="text-xl font-headline font-bold tracking-tighter text-tertiary">
          ECOpath
          </span>
        </div>
        <span className="material-symbols-outlined text-outline cursor-pointer">account_circle</span>
      </motion.header>

      {/* Desktop SideNav */}
      <SideNav />

      {/* Main content */}
      <main
        className="flex-1 flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0 transition-all duration-300"
        style={{ paddingLeft: "var(--sidenav-w, 0px)" } as React.CSSProperties}
      >
        {/* Left panel */}
        <motion.aside
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="w-full lg:w-sidebar_width bg-surface-container-lowest border-r border-outline-variant flex flex-col z-20 overflow-y-auto lg:h-screen lg:sticky lg:top-0"
        >
          <div className="p-md border-b border-outline-variant">
            <TripForm onSubmit={handleSubmit} loading={loading} />
          </div>

          <div className="flex-1 p-md overflow-y-auto">
            {loading && <LoadingState />}
            {error && (
              <div className="bg-error-container border border-error text-on-error-container rounded p-md text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
            <ReasoningPanel loading={loading} reasoning={result?.reasoning ?? null} />
            {result && !loading && <ResultsPanel comparison={result} />}
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-2">
                <span className="material-symbols-outlined text-4xl text-outline-variant">route</span>
                <p>Enter a trip above to see route options.</p>
              </div>
            )}
          </div>
        </motion.aside>

        {/* Right: map */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex-1 bg-surface-dim relative min-h-[300px] lg:min-h-screen"
        >
          <MapView origin={mapOrigin} destination={mapDest} routeComparison={result} />
        </motion.section>
      </main>

      {/* Mobile BottomNav */}
      <nav className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant">
        <a className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="#">
          <span className="material-symbols-outlined mb-1">explore</span>
          Explore
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/plan-day">
          <span className="material-symbols-outlined mb-1">calendar_today</span>
          Plan Day
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/travel-history">
          <span className="material-symbols-outlined mb-1">history</span>
          History
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/analytics">
          <span className="material-symbols-outlined mb-1">eco</span>
          Analytics
        </a>
      </nav>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center text-center p-lg">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 bg-tertiary-fixed flex items-center justify-center rounded-full mb-md border-2 border-tertiary"
      >
        <span className="material-symbols-outlined text-3xl text-tertiary">route</span>
      </motion.div>
      <h2 className="font-headline font-semibold text-lg text-on-background mb-xs">Optimizing Routes</h2>
      <p className="text-sm text-on-surface-variant mb-md">Calculating fastest, greenest, and most efficient paths.</p>
      <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mb-sm">
        <motion.div
          className="bg-tertiary h-full rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "85%" }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      </div>
      <p className="text-xs font-medium text-tertiary">Evaluating potential routes…</p>
    </div>
  );
}
