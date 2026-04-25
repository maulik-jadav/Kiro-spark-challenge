/**
 * ReasoningPanel Unit Tests — Override Badge
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * Tests that the constraint_override badge renders correctly based on the
 * constraint_override field in AgentReasoning.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import ReasoningPanel from "../ReasoningPanel";
import { AgentReasoning } from "@/types/api";

function makeReasoning(overrides: Partial<AgentReasoning> = {}): AgentReasoning {
  return {
    recommended_mode: "bus",
    summary: "Bus is the greenest option.",
    justification: "Bus emits the least CO2 per passenger-km.",
    constraint_analysis: null,
    constraint_override: false,
    ...overrides,
  };
}

test("renders override badge when constraint_override is true", () => {
  const reasoning = makeReasoning({ constraint_override: true });

  render(<ReasoningPanel reasoning={reasoning} loading={false} />);

  expect(
    screen.getByText("Recommendation adjusted based on your constraint")
  ).toBeInTheDocument();

  // The swap_horiz icon should be present
  expect(screen.getByText("swap_horiz")).toBeInTheDocument();
});

test("does not render override badge when constraint_override is false", () => {
  const reasoning = makeReasoning({ constraint_override: false });

  render(<ReasoningPanel reasoning={reasoning} loading={false} />);

  expect(
    screen.queryByText("Recommendation adjusted based on your constraint")
  ).not.toBeInTheDocument();

  // The swap_horiz icon should not be present
  expect(screen.queryByText("swap_horiz")).not.toBeInTheDocument();
});
