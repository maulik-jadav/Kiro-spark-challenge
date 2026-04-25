"use client";

import { useState } from "react";
import { ALL_MODES, MODE_LABELS, TransitMode } from "@/types/api";
import ConstraintInput from "./ConstraintInput";

interface TripFormProps {
  onSubmit: (origin: string, destination: string, modes: TransitMode[] | null, constraint: string | null) => void;
  loading: boolean;
}

export default function TripForm({ onSubmit, loading }: TripFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedModes, setSelectedModes] = useState<TransitMode[]>([]);
  const [constraint, setConstraint] = useState("");
  const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});

  function toggleMode(mode: TransitMode) {
    setSelectedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!origin.trim()) newErrors.origin = "Origin is required.";
    if (!destination.trim()) newErrors.destination = "Destination is required.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    onSubmit(origin.trim(), destination.trim(), selectedModes.length > 0 ? selectedModes : null, constraint.trim() || null);
  }

  const inputClass =
    "w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="mb-4">
        <h2 className="font-headline font-semibold text-lg text-on-surface">Plan Your Journey</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Enter details to find optimal paths.</p>
      </div>

      {/* Location inputs with connecting line */}
      <div className="relative space-y-3">
        <div className="absolute left-5 top-8 bottom-8 w-px bg-outline-variant z-0 hidden sm:block" />

        {/* Origin */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container-lowest items-center justify-center border border-outline-variant shrink-0">
            <span className="material-symbols-outlined text-outline text-[18px]">trip_origin</span>
          </div>
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] sm:hidden">trip_origin</span>
            <input
              id="origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Enter origin"
              className={inputClass}
            />
          </div>
        </div>
        {errors.origin && <p className="text-error text-xs ml-13">{errors.origin}</p>}

        {/* Destination */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-tertiary items-center justify-center border border-tertiary shrink-0">
            <span className="material-symbols-outlined text-on-tertiary text-[18px]">location_on</span>
          </div>
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-[18px] sm:hidden">location_on</span>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter destination"
              className={inputClass}
            />
          </div>
        </div>
        {errors.destination && <p className="text-error text-xs">{errors.destination}</p>}
      </div>

      <div className="h-px w-full bg-outline-variant" />

      {/* Mode chips */}
      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
          Transit modes <span className="font-normal normal-case tracking-normal">(blank = all)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_MODES.map((mode) => {
            const active = selectedModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => toggleMode(mode)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  active
                    ? "bg-tertiary text-on-tertiary border-tertiary"
                    : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary"
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

      <ConstraintInput value={constraint} onChange={setConstraint} disabled={loading} />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-semibold text-xs uppercase tracking-widest py-3 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">route</span>
        {loading ? "Planning route…" : "Calculate Routes"}
      </button>
    </form>
  );
}
