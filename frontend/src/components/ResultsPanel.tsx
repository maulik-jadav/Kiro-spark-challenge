"use client";

import { motion } from "framer-motion";
import { RouteComparison } from "@/types/api";
import RouteCard from "./RouteCard";

interface ResultsPanelProps {
  comparison: RouteComparison;
}

export default function ResultsPanel({ comparison }: ResultsPanelProps) {
  const { options, greenest, fastest, cheapest, savings_vs_driving_kg } = comparison;

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <motion.h2
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="font-headline font-semibold text-lg text-on-background"
        >
          {options.length} Route{options.length !== 1 ? "s" : ""} Found
        </motion.h2>

        {savings_vs_driving_kg != null && savings_vs_driving_kg > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="bg-secondary-container/30 border border-secondary text-secondary text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">eco</span>
            Save {savings_vs_driving_kg.toFixed(2)} kg CO₂ vs driving
          </motion.div>
        )}
      </div>

      <div className="flex flex-col gap-md">
        {options.map((option, i) => (
          <RouteCard
            key={option.mode}
            option={option}
            isGreenest={greenest?.mode === option.mode}
            isFastest={fastest?.mode === option.mode}
            isCheapest={cheapest?.mode === option.mode}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
