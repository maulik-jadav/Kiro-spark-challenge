"use client";

import { useState } from "react";
import { AgentReasoning, MODE_LABELS } from "@/types/api";

interface ReasoningPanelProps {
  reasoning: AgentReasoning | null;
  loading: boolean;
}

export default function ReasoningPanel({ reasoning, loading }: ReasoningPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Hidden state: don't render when there's no reasoning and not loading
  if (!reasoning && !loading) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="border border-outline-variant bg-surface-container-lowest rounded p-md flex items-center gap-3">
        <span className="material-symbols-outlined text-2xl text-tertiary animate-spin">
          progress_activity
        </span>
        <span className="text-sm font-medium text-on-surface-variant">
          Agent is reasoning…
        </span>
      </div>
    );
  }

  // Complete state: reasoning is non-null here
  if (!reasoning) {
    return null;
  }

  return (
    <div className="border border-outline-variant bg-surface-container-lowest rounded overflow-hidden">
      {/* Header */}
      <div className="p-md">
        <div className="flex items-center gap-2 mb-sm">
          <span className="material-symbols-outlined text-lg text-secondary">psychology</span>
          <span className="text-xs font-semibold text-secondary uppercase tracking-widest">
            Agent Recommendation
          </span>
        </div>

        <p className="font-headline font-semibold text-base text-on-background">
          {MODE_LABELS[reasoning.recommended_mode]}
        </p>
        <p className="text-sm text-on-surface-variant mt-xs">
          {reasoning.summary}
        </p>

        {/* Override badge */}
        {reasoning.constraint_override && (
          <div className="flex items-center gap-1.5 mt-sm text-xs text-tertiary">
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
            Recommendation adjusted based on your constraint
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-tertiary hover:underline focus:outline-none focus:ring-2 focus:ring-tertiary rounded flex items-center gap-1"
          aria-expanded={expanded}
        >
          <span className="material-symbols-outlined text-[16px]">
            {expanded ? "expand_less" : "expand_more"}
          </span>
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-outline-variant p-md space-y-md">
          <div>
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-xs">
              Justification
            </h4>
            <p className="text-sm text-on-surface">{reasoning.justification}</p>
          </div>

          {reasoning.constraint_analysis != null && (
            <div>
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-xs">
                Constraint Analysis
              </h4>
              <p className="text-sm text-on-surface">{reasoning.constraint_analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
