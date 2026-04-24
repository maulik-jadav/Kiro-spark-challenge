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
        <h2 className="font-headline font-semibold text-lg text-on-background">
          {options.length} Route{options.length !== 1 ? "s" : ""} Found
        </h2>
        {savings_vs_driving_kg != null && savings_vs_driving_kg > 0 && (
          <div className="bg-secondary-container/30 border border-secondary text-secondary text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">eco</span>
            Save {savings_vs_driving_kg.toFixed(2)} kg CO₂ vs driving
          </div>
        )}
      </div>

      <div className="flex flex-col gap-md">
        {options.map((option) => (
          <RouteCard
            key={option.mode}
            option={option}
            isGreenest={greenest?.mode === option.mode}
            isFastest={fastest?.mode === option.mode}
            isCheapest={cheapest?.mode === option.mode}
          />
        ))}
      </div>
    </div>
  );
}
