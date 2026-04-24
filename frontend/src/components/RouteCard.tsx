"use client";

import { useState } from "react";
import { MODE_LABELS, RouteOption } from "@/types/api";

interface RouteCardProps {
  option: RouteOption;
  isGreenest: boolean;
  isFastest: boolean;
  isCheapest: boolean;
}

const BADGE_CONFIG = {
  fastest: {
    label: "FASTEST",
    icon: "bolt",
    bg: "bg-route-fastest",
    text: "text-on-primary",
    border: "border-l-route-fastest",
    ring: "shadow-[0_0_0_2px_rgba(0,53,46,0.1)]",
  },
  greenest: {
    label: "GREENEST",
    icon: "eco",
    bg: "bg-route-greenest",
    text: "text-on-secondary",
    border: "border-l-route-greenest",
    ring: "",
  },
  cheapest: {
    label: "CHEAPEST",
    icon: "attach_money",
    bg: "bg-route-cheapest",
    text: "text-on-tertiary",
    border: "border-l-route-cheapest",
    ring: "",
  },
};

export default function RouteCard({ option, isGreenest, isFastest, isCheapest }: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const badge = isFastest
    ? BADGE_CONFIG.fastest
    : isGreenest
    ? BADGE_CONFIG.greenest
    : isCheapest
    ? BADGE_CONFIG.cheapest
    : null;

  return (
    <div
      className={`border border-outline-variant bg-surface-container-lowest rounded border-l-[3px] relative cursor-pointer transition-colors ${
        badge ? `${badge.border} ${badge.ring}` : "border-l-outline-variant"
      }`}
    >
      <div className="p-md">
        {/* Badge */}
        {badge && (
          <div
            className={`absolute top-md right-md ${badge.bg} ${badge.text} font-semibold text-[11px] uppercase tracking-widest px-sm py-xs rounded flex items-center gap-1`}
          >
            <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
            {badge.label}
          </div>
        )}

        {/* Mode + duration */}
        <div className="flex flex-col gap-sm pr-24">
          <span className="font-headline font-semibold text-xl text-on-background">
            {Math.round(option.total_duration_min)} min
          </span>
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

        {/* Expand toggle */}
        {option.segments.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded((v) => !v)}
            className="mt-3 text-xs text-tertiary hover:underline focus:outline-none focus:ring-2 focus:ring-tertiary rounded"
            aria-expanded={expanded}
          >
            {expanded ? "▲ Hide segments" : "▼ Show segments"}
          </button>
        )}
      </div>

      {/* Segments table */}
      {expanded && (
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
                <tr key={i} className="hover:bg-surface-container-low">
                  <td className="px-md py-sm font-medium text-on-surface">{MODE_LABELS[seg.mode]}</td>
                  <td className="px-md py-sm text-on-surface-variant tabular-nums">{seg.distance_km.toFixed(1)} km</td>
                  <td className="px-md py-sm text-on-surface-variant tabular-nums">{Math.round(seg.duration_min)} min</td>
                  <td className="px-md py-sm text-on-surface-variant tabular-nums">{seg.emissions_g.toFixed(0)} g</td>
                  <td className="px-md py-sm text-on-surface-variant tabular-nums">${seg.cost_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
