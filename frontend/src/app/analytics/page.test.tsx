/**
 * Tests for AnalyticsPage
 * Covers: rendering states (loading, error, empty, populated),
 * KPI cards, chart rendering, insights panel, and navigation.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AnalyticsPage from "./page";
import { DbTrip } from "@/lib/supabase";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) =>
          // eslint-disable-next-line react/display-name
          ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
            React.createElement(tag, props, children),
      }
    ),
  };
});

jest.mock("next/link", () => {
  // eslint-disable-next-line react/display-name
  return ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children);
});

jest.mock("@/components/EarthGlobe", () => {
  // eslint-disable-next-line react/display-name
  return function EarthGlobe() {
    return React.createElement("div", { "data-testid": "earth-globe" });
  };
});

// Recharts uses ResizeObserver — stub it for jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Supabase mock — controlled per test via `mockSupabaseResult`
let mockSupabaseResult: { data: DbTrip[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(mockSupabaseResult),
        }),
      }),
    }),
  },
  DEMO_USER_ID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<DbTrip> = {}): DbTrip {
  return {
    id: "trip-1",
    user_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    origin: "Home, City",
    destination: "Office, City",
    chosen_mode: "bus",
    total_distance_km: 12.5,
    total_duration_min: 35,
    total_emissions_kg: 0.42,
    total_cost_usd: 2.5,
    green_emissions_kg: 0.2,
    green_cost_usd: 1.0,
    green_mode: "light_rail",
    savings_vs_driving_kg: 1.5,
    trip_date: "2026-04-20T08:00:00Z",
    created_at: "2026-04-20T08:00:00Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnalyticsPage", () => {
  beforeEach(() => {
    mockSupabaseResult = { data: [], error: null };
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows a loading spinner initially", () => {
    render(<AnalyticsPage />);
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows an error message when supabase returns an error", async () => {
    mockSupabaseResult = { data: null, error: { message: "Connection refused" } };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it("shows empty state when no trips are returned", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
    });
  });

  // ── KPI cards ────────────────────────────────────────────────────────────

  it("renders KPI cards with correct totals for a single trip", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ total_emissions_kg: 1.0, green_emissions_kg: 0.4 })],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText("1.00 kg")).toBeInTheDocument(); // Actual CO₂
      expect(screen.getByText("0.40 kg")).toBeInTheDocument(); // Green Path CO₂
      expect(screen.getByText("0.60 kg")).toBeInTheDocument(); // CO₂ You Could Save
      expect(screen.getByText("60%")).toBeInTheDocument();     // Reduction Possible
    });
  });

  it("uses total_emissions_kg as green fallback when green_emissions_kg is null", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ total_emissions_kg: 0.5, green_emissions_kg: null })],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      // actual == green → saved = 0, reduction = 0%
      expect(screen.getByText("0.50 kg")).toBeInTheDocument(); // Actual CO₂
      expect(screen.getByText("0.00 kg")).toBeInTheDocument(); // CO₂ You Could Save
      expect(screen.getByText("0%")).toBeInTheDocument();      // Reduction Possible
    });
  });

  it("aggregates KPI totals across multiple trips", async () => {
    mockSupabaseResult = {
      data: [
        makeTrip({ id: "t1", total_emissions_kg: 1.0, green_emissions_kg: 0.5 }),
        makeTrip({ id: "t2", total_emissions_kg: 2.0, green_emissions_kg: 1.0 }),
      ],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText("3.00 kg")).toBeInTheDocument(); // Actual CO₂
      expect(screen.getByText("1.50 kg")).toBeInTheDocument(); // Green Path CO₂
      expect(screen.getByText("50%")).toBeInTheDocument();     // Reduction Possible
    });
  });

  // ── Charts ───────────────────────────────────────────────────────────────

  it("renders the bar chart section title", async () => {
    mockSupabaseResult = { data: [makeTrip()], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/actual vs green path emissions per trip/i)).toBeInTheDocument();
    });
  });

  it("renders the cumulative line chart section title", async () => {
    mockSupabaseResult = { data: [makeTrip()], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/cumulative co₂ over time/i)).toBeInTheDocument();
    });
  });

  it("renders the pie chart section title", async () => {
    mockSupabaseResult = { data: [makeTrip()], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/emissions by transport mode/i)).toBeInTheDocument();
    });
  });

  // ── Insights panel ───────────────────────────────────────────────────────

  it("renders the Green Path Insights panel", async () => {
    mockSupabaseResult = { data: [makeTrip()], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/green path insights/i)).toBeInTheDocument();
    });
  });

  it("shows insight rows for trips with positive savings", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ savings_vs_driving_kg: 2.5, green_mode: "light_rail" })],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/light rail/i)).toBeInTheDocument();
      expect(screen.getByText(/2\.50 kg co₂/i)).toBeInTheDocument();
    });
  });

  it("does not show insight rows for trips with zero or negative savings", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ savings_vs_driving_kg: 0, green_mode: "bus" })],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      // The insight list should be empty — no "would save" text
      expect(screen.queryByText(/would save/i)).not.toBeInTheDocument();
    });
  });

  it("shows at most 4 insight rows even with more trips", async () => {
    mockSupabaseResult = {
      data: Array.from({ length: 6 }, (_, i) =>
        makeTrip({ id: `t${i}`, savings_vs_driving_kg: i + 1, green_mode: "bus" })
      ),
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      const rows = screen.getAllByText(/would save/i);
      expect(rows.length).toBeLessThanOrEqual(4);
    });
  });

  it("shows the summary reduction sentence in the insights panel", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ total_emissions_kg: 1.0, green_emissions_kg: 0.6, savings_vs_driving_kg: 0.4 })],
      error: null,
    };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/by consistently choosing green paths/i)).toBeInTheDocument();
    });
  });

  // ── Page header & navigation ─────────────────────────────────────────────

  it("renders the PathFinder brand name", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("PathFinder").length).toBeGreaterThan(0);
    });
  });

  it("renders the page heading", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/environmental impact/i)).toBeInTheDocument();
    });
  });

  it("renders navigation links for all sections", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /search/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /plan day/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /travel history/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /analytics/i }).length).toBeGreaterThan(0);
    });
  });

  it("renders the EarthGlobe component", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("earth-globe").length).toBeGreaterThan(0);
    });
  });
});
