"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TransitMode, Priority } from "@/types/api";
import ConstraintInput from "./ConstraintInput";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";

interface TripFormProps {
  onSubmit: (origin: string, destination: string, modes: TransitMode[] | null, constraint: string | null, priority: Priority) => void;
  loading: boolean;
}

export default function TripForm({ onSubmit, loading }: TripFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [constraint, setConstraint] = useState("");
  const [priority, setPriority] = useState<Priority>("best_tradeoff");
  const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!origin.trim()) newErrors.origin = "Origin is required.";
    if (!destination.trim()) newErrors.destination = "Destination is required.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    onSubmit(origin.trim(), destination.trim(), null, constraint.trim() || null, "best_tradeoff");
  }

  const inputClass =
    "w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-all duration-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-4"
      >
        <h2 className="font-headline font-semibold text-lg text-on-surface">Plan Your Journey</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Enter details to find optimal paths.</p>
      </motion.div>

      {/* Location inputs */}
      <div className="relative space-y-3">
        <div className="absolute left-5 top-8 bottom-8 w-px bg-outline-variant z-0 hidden sm:block" />

        {/* Origin */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container-lowest items-center justify-center border border-outline-variant shrink-0">
            <span className="material-symbols-outlined text-outline text-[18px]">trip_origin</span>
          </div>
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] sm:hidden">trip_origin</span>
            <PlaceAutocompleteInput
              id="origin"
              value={origin}
              onChange={setOrigin}
              onPlaceSelect={() => {}}
              placeholder="Enter origin"
              className={inputClass}
              label="Origin"
            />
          </div>
        </motion.div>
        {errors.origin && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-error text-xs ml-13"
          >
            {errors.origin}
          </motion.p>
        )}

        {/* Destination */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-tertiary items-center justify-center border border-tertiary shrink-0">
            <span className="material-symbols-outlined text-on-tertiary text-[18px]">location_on</span>
          </div>
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-[18px] sm:hidden">location_on</span>
            <PlaceAutocompleteInput
              id="destination"
              value={destination}
              onChange={setDestination}
              onPlaceSelect={() => {}}
              placeholder="Enter destination"
              className={inputClass}
              label="Destination"
            />
          </div>
        </motion.div>
        {errors.destination && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-error text-xs"
          >
            {errors.destination}
          </motion.p>
        )}
      </div>

      <ConstraintInput value={constraint} onChange={setConstraint} disabled={loading} />

      {/* Priority selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.18 }}
      >
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
          Priority
        </p>
        <div className="flex gap-1.5">
          {([
            { value: "fastest" as Priority, label: "Fastest", icon: "bolt" },
            { value: "greenest" as Priority, label: "Greenest", icon: "eco" },
            { value: "best_tradeoff" as Priority, label: "Best Trade-off", icon: "balance" },
          ]).map((opt) => {
            const active = priority === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05 }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold border transition-colors duration-200 ${
                  active
                    ? "bg-tertiary text-on-tertiary border-tertiary"
                    : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                {opt.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <motion.button
        type="submit"
        disabled={loading}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.97 }}
        className="w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-semibold text-xs uppercase tracking-widest py-3 rounded transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <motion.span
          animate={loading ? { rotate: 360 } : { rotate: 0 }}
          transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
          className="material-symbols-outlined text-[18px]"
        >
          route
        </motion.span>
        {loading ? "Planning route…" : "Calculate Routes"}
      </motion.button>
    </form>
  );
}
