"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MODE_LABELS, RouteOption, ScoredRoute } from "@/types/api";

interface RouteCardProps {
  option: RouteOption;
  isGreenest: boolean;
  isFastest: boolean;
  isRecommended: boolean;
  scoredRoute?: ScoredRoute;
  index?: number;
}

const BADGE_CONFIG = {
  recommended: {
    label: "RECOMMENDED",
    icon: "star",
    bg: "bg-indigo-500",
    text: "text-white",
    border: "border-l-indigo-500",
    ring: "shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
  },
  fastest: {
    label: "FASTEST",
    icon: "bolt",
    bg: "bg-amber-400",
    text: "text-amber-900",
    border: "border-l-amber-400",
    ring: "shadow-[0_0_0_2px_rgba(234,179,8,0.15)]",
  },
  greenest: {
    label: "GREENEST",
    icon: "eco",
    bg: "bg-route-greenest",
    text: "text-on-secondary",
    border: "border-l-route-greenest",
    ring: "",
  },
};

export default function RouteCard({ option, isGreenest, isFastest, isRecommended, scoredRoute, index = 0 }: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Collect all applicable badges
  const badges: typeof BADGE_CONFIG[keyof typeof BADGE_CONFIG][] = [];
  if (isRecommended) badges.push(BADGE_CONFIG.recommended);
  if (isFastest) badges.push(BADGE_CONFIG.fastest);
  if (isGreenest) badges.push(BADGE_CONFIG.greenest);

  // Use the first badge for the border color
  const primaryBadge = badges[0] ?? null;

  // Practicality note
  const hasPracticalityPenalty = scoredRoute && scoredRoute.practicality_penalty > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
      className={`border border-outline-variant bg-surface-container-lowest rounded border-l-[3px] relative cursor-pointer transition-shadow ${
        primaryBadge ? `${primaryBadge.border} ${primaryBadge.ring}` : "border-l-outline-variant"
      }`}
    >
      <div className="p-md">
        {/* Mode + duration header with badges right-aligned */}
        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-headline font-semibold text-xl text-on-background">
              {Math.round(option.total_duration_min)} min
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`${b.bg} ${b.text} font-semibold text-[11px] uppercase tracking-widest px-sm py-xs rounded flex items-center gap-1`}
                >
                  <span className="material-symbols-outlined text-[14px]">{b.icon}</span>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center border-b border-outline-variant pb-sm">
            <span className="text-sm font-medium text-on-surface-variant">{MODE_LABELS[option.mode]}</span>
            <span className="text-sm font-medium text-on-surface-variant tabular-nums">
              {option.total_distance_km.toFixed(1)} km
            </span>
          </div>
          <div className="flex justify-between items-center pt-xs">
            <span
              className={`text-sm font-semibold tabular-nums ${
                isGreenest ? "text-secondary" : "text-on-surface-variant"
              }`}
            >
              {option.total_emissions_kg.toFixed(2)} kg CO₂
            </span>
            <span className="text-sm font-medium text-on-surface-variant tabular-nums">
              ${option.total_cost_usd.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Practicality note */}
        {hasPracticalityPenalty && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.25 }}
            className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Long {option.mode === "walking" ? "walk" : "ride"} — penalized for distance
          </motion.div>
        )}

        {/* Expand toggle */}
        {option.segments.length > 0 && (
          <motion.button
            onClick={() => setExpanded((v) => !v)}
            whileTap={{ scale: 0.95 }}
            className="mt-3 text-xs text-tertiary hover:underline focus:outline-none focus:ring-2 focus:ring-tertiary rounded flex items-center gap-1"
            aria-expanded={expanded}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="material-symbols-outlined text-[14px]"
            >
              expand_more
            </motion.span>
            {expanded ? "Hide segments" : "Show segments"}
          </motion.button>
        )}
      </div>

      {/* Segments table — animated expand */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="segments"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-outline-variant overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase tracking-widest">
                  <tr>
                    <th className="px-md py-sm">Mode</th>
                    <th className="px-md py-sm">Distance</th>
                    <th className="px-md py-sm">Duration</th>
                    <th className="px-md py-sm">Emissions</th>
                    <th className="px-md py-sm">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {option.segments.map((seg, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-md py-sm font-medium text-on-surface">{MODE_LABELS[seg.mode]}</td>
                      <td className="px-md py-sm text-on-surface-variant tabular-nums">{seg.distance_km.toFixed(1)} km</td>
                      <td className="px-md py-sm text-on-surface-variant tabular-nums">{Math.round(seg.duration_min)} min</td>
                      <td className="px-md py-sm text-on-surface-variant tabular-nums">{seg.emissions_g.toFixed(0)} g</td>
                      <td className="px-md py-sm text-on-surface-variant tabular-nums">${seg.cost_usd.toFixed(2)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
