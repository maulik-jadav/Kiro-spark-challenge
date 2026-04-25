/**
 * Tests for TravelHistoryPage
 * Covers: rendering states (loading, error, empty, populated),
 * summary stats, trip card display, and savings badge.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TravelHistoryPage from "./page";
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
    origin: "Home",
    destination: "Office",
    chosen_mode: "bus",
    total_distance_km: 12.5,
    total_duration_min: 35,
    total_emissions_kg: 0.42,
    total_cost_usd: 2.5,
    green_emissions_kg: null,
    green_cost_usd: null,
    green_mode: null,
    savings_vs_driving_kg: null,
    trip_date: "2026-04-20T08:00:00Z",
    created_at: "2026-04-20T08:00:00Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TravelHistoryPage", () => {
  beforeEach(() => {
    mockSupabaseResult = { data: [], error: null };
  });

  it("shows a loading spinner initially", () => {
    // Never resolves during this test
    jest.mock("@/lib/supabase", () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => new Promise(() => {}),
            }),
          }),
        }),
      },
      DEMO_USER_ID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    }));

    render(<TravelHistoryPage />);
    expect(screen.getByText(/loading trips/i)).toBeInTheDocument();
  });

  it("shows an error message when supabase returns an error", async () => {
    mockSupabaseResult = { data: null, error: { message: "Connection refused" } };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no trips are returned", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no trips found/i)).toBeInTheDocument();
    });
  });

  it("renders trip cards when trips are returned", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ origin: "Downtown", destination: "Airport" })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Downtown")).toBeInTheDocument();
      expect(screen.getByText("Airport")).toBeInTheDocument();
    });
  });

  it("displays the correct mode label for a trip", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ chosen_mode: "light_rail" })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Light Rail")).toBeInTheDocument();
    });
  });

  it("shows summary stat cards with correct totals", async () => {
    mockSupabaseResult = {
      data: [
        makeTrip({ total_emissions_kg: 1.0, total_cost_usd: 3.0, savings_vs_driving_kg: 2.0 }),
        makeTrip({ id: "trip-2", total_emissions_kg: 0.5, total_cost_usd: 1.5, savings_vs_driving_kg: 1.0 }),
      ],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument(); // Total Trips
      expect(screen.getByText("1.50 kg")).toBeInTheDocument(); // Total CO₂
      expect(screen.getByText("3.00 kg")).toBeInTheDocument(); // CO₂ Saved
    });
  });

  it("shows the savings badge when savings_vs_driving_kg is positive", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ savings_vs_driving_kg: 1.23 })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/saved 1\.23 kg/i)).toBeInTheDocument();
    });
  });

  it("does not show savings badge when savings_vs_driving_kg is null", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ savings_vs_driving_kg: null })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.queryByText(/saved.*kg/i)).not.toBeInTheDocument();
    });
  });

  it("does not show savings badge when savings_vs_driving_kg is zero or negative", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ savings_vs_driving_kg: 0 })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.queryByText(/saved.*kg/i)).not.toBeInTheDocument();
    });
  });

  it("formats the trip date correctly", async () => {
    mockSupabaseResult = {
      data: [makeTrip({ trip_date: "2026-04-20T08:00:00Z" })],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/apr 20, 2026/i)).toBeInTheDocument();
    });
  });

  it("renders the page header and navigation links", async () => {
    mockSupabaseResult = { data: [], error: null };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByText("ECOpath").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/travel history/i).length).toBeGreaterThan(0);
    });
  });

  it("renders trip distance, duration, emissions, and cost metrics", async () => {
    mockSupabaseResult = {
      data: [
        makeTrip({
          total_distance_km: 8.3,
          total_duration_min: 22,
          total_emissions_kg: 0.123,
          total_cost_usd: 1.75,
        }),
      ],
      error: null,
    };

    render(<TravelHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("8.3 km")).toBeInTheDocument();
      expect(screen.getByText("22 min")).toBeInTheDocument();
      expect(screen.getByText("0.123 kg")).toBeInTheDocument();
      expect(screen.getByText("1.75")).toBeInTheDocument();
    });
  });
});
