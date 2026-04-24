"use client";

import { useState } from "react";
import TripForm from "@/components/TripForm";
import ResultsPanel from "@/components/ResultsPanel";
import MapView from "@/components/MapView";
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
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest/80 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-outline-variant lg:hidden">
        <span className="text-xl font-headline font-bold tracking-tighter text-tertiary">
          PathProject
        </span>
        <span className="material-symbols-outlined text-outline cursor-pointer">account_circle</span>
      </header>

      {/* Desktop SideNav */}
      <nav className="hidden lg:flex flex-col h-full pt-8 pb-8 px-4 fixed left-0 w-sidebar_width border-r border-outline-variant bg-surface-container-lowest z-40 overflow-y-auto">
        <div className="mb-8 px-4">
          <h1 className="font-headline font-bold text-3xl text-tertiary tracking-tighter">PathProject</h1>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest mt-1">
            Logistics Intelligence
          </p>
        </div>

        <ul className="flex-1 space-y-1">
          <li>
            <a className="flex items-center gap-4 px-4 py-3 rounded bg-tertiary-container/10 text-tertiary border-l-[3px] border-tertiary font-semibold text-xs uppercase tracking-widest" href="#">
              <span className="material-symbols-outlined">search</span>
              <span>Search</span>
            </a>
          </li>
          <li>
            <a className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="#">
              <span className="material-symbols-outlined">directions_car</span>
              <span>Routes</span>
            </a>
          </li>
          <li>
            <a className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="#">
              <span className="material-symbols-outlined">eco</span>
              <span>Analytics</span>
            </a>
          </li>
          <li>
            <a className="flex items-center gap-4 px-4 py-3 rounded text-on-surface-variant border-l-[3px] border-transparent hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest" href="#">
              <span className="material-symbols-outlined">settings</span>
              <span>Settings</span>
            </a>
          </li>
        </ul>
      </nav>

      {/* Main content — offset by sidebar on desktop */}
      <main className="flex-1 flex flex-col lg:flex-row lg:pl-sidebar_width min-h-screen pt-16 lg:pt-0">
        {/* Left panel: form + results */}
        <aside className="w-full lg:w-sidebar_width bg-surface-container-lowest border-r border-outline-variant flex flex-col z-20 overflow-y-auto lg:h-screen lg:sticky lg:top-0">
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
            {result && !loading && <ResultsPanel comparison={result} />}
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-2">
                <span className="material-symbols-outlined text-4xl text-outline-variant">route</span>
                <p>Enter a trip above to see route options.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right: map */}
        <section className="flex-1 bg-surface-dim relative min-h-[300px] lg:min-h-screen">
          <MapView origin={mapOrigin} destination={mapDest} />
        </section>
      </main>

      {/* Mobile BottomNav */}
      <nav className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant">
        <a className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="#">
          <span className="material-symbols-outlined mb-1">explore</span>
          Explore
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="#">
          <span className="material-symbols-outlined mb-1">map</span>
          Planned
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="#">
          <span className="material-symbols-outlined mb-1">tune</span>
          Settings
        </a>
      </nav>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center text-center p-lg">
      <div className="w-16 h-16 bg-tertiary-fixed flex items-center justify-center rounded-full mb-md border-2 border-tertiary">
        <span className="material-symbols-outlined text-3xl text-tertiary">route</span>
      </div>
      <h2 className="font-headline font-semibold text-lg text-on-background mb-xs">Optimizing Routes</h2>
      <p className="text-sm text-on-surface-variant mb-md">Calculating fastest, greenest, and most efficient paths.</p>
      <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mb-sm">
        <div className="bg-tertiary h-full w-2/3 rounded-full animate-pulse" />
      </div>
      <p className="text-xs font-medium text-tertiary">Evaluating potential routes…</p>
    </div>
  );
}
