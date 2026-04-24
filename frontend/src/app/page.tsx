"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TripForm from "@/components/TripForm";
import ResultsPanel from "@/components/ResultsPanel";
import MapView from "@/components/MapView";
import EarthGlobe from "@/components/EarthGlobe";
import { planRoute } from "@/lib/api";
import type { RouteComparison, TransitMode } from "@/types/api";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteComparison | null>(null);
  const [mapOrigin, setMapOrigin] = useState<string | null>(null);
  const [mapDest, setMapDest] = useState<string | null>(null);

  async function handleSubmit(
    origin: string,
    destination: string,
    modes: TransitMode[] | null
  ) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await planRoute(origin, destination, modes);
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
            PathProject
          </span>
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
        {/* Logo + Globe */}
        <div className="mb-8 px-4 flex items-center gap-4">
          <EarthGlobe size={56} />
          <div>
            <h1 className="font-headline font-bold text-3xl text-tertiary tracking-tighter">PathProject</h1>
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest mt-1">
              Logistics Intelligence
            </p>
          </div>
        </div>

        <ul className="flex-1 space-y-1">
          {[
            { icon: "search", label: "Search", active: true },
            { icon: "directions_car", label: "Routes", active: false },
            { icon: "eco", label: "Analytics", active: false },
            { icon: "settings", label: "Settings", active: false },
          ].map((item, i) => (
            <motion.li
              key={item.label}
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.35, ease: "easeOut" }}
            >
              <a
                className={`flex items-center gap-4 px-4 py-3 rounded border-l-[3px] font-semibold text-xs uppercase tracking-widest transition-all duration-200 ${
                  item.active
                    ? "bg-tertiary-container/10 text-tertiary border-tertiary"
                    : "text-on-surface-variant border-transparent hover:bg-surface-variant hover:translate-x-1"
                }`}
                href="#"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </motion.li>
          ))}
        </ul>
      </motion.nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row lg:pl-sidebar_width min-h-screen pt-16 lg:pt-0">
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
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                >
                  <LoadingState />
                </motion.div>
              )}
              {error && !loading && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-error-container border border-error text-on-error-container rounded p-md text-sm"
                >
                  <strong>Error:</strong> {error}
                </motion.div>
              )}
              {result && !loading && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <ResultsPanel comparison={result} />
                </motion.div>
              )}
              {!result && !loading && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-3"
                >
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="material-symbols-outlined text-4xl text-outline-variant"
                  >
                    route
                  </motion.span>
                  <p>Enter a trip above to see route options.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>

        {/* Right: map */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex-1 bg-surface-dim relative min-h-[300px] lg:min-h-screen"
        >
          <MapView origin={mapOrigin} destination={mapDest} />
        </motion.section>
      </main>

      {/* Mobile BottomNav */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant"
      >
        {[
          { icon: "explore", label: "Explore", active: true },
          { icon: "map", label: "Planned", active: false },
          { icon: "tune", label: "Settings", active: false },
        ].map((item) => (
          <a
            key={item.label}
            className={`flex flex-col items-center font-semibold text-[10px] uppercase tracking-widest transition-colors ${
              item.active ? "text-tertiary" : "text-on-surface-variant hover:text-tertiary"
            }`}
            href="#"
          >
            <span className="material-symbols-outlined mb-1">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </motion.nav>
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
