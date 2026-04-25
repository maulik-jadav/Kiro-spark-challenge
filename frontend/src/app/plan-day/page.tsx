"use client";

import { useState } from "react";
import { planDay, getAuthUrl, ApiError } from "@/lib/api";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import SideNav from "@/components/SideNav";
import type {
  DayPlanResponse,
  CalendarEvent,
  TransitWindow,
  ValidationErrorDetail,
} from "@/types/api";

export default function PlanDayPage() {
  const [date, setDate] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DayPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrorDetail[]>([]);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  function fieldError(field: string): string | undefined {
    return fieldErrors.find((e) => e.field === field)?.reason;
  }

  async function handleConnectCalendar() {
    setOauthMessage(null);
    setOauthLoading(true);
    try {
      const { auth_url } = await getAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 503) {
        setOauthMessage("OAuth is not configured");
      } else {
        setOauthMessage(
          err instanceof Error ? err.message : "Failed to connect calendar"
        );
      }
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);
    setResult(null);
    try {
      const data = await planDay({
        date,
        home_address: homeAddress,
        session_id: sessionId,
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.errors) {
          setFieldErrors(err.errors);
        } else if (err.statusCode === 503) {
          setError("OAuth is not configured");
        } else {
          setError(err.message);
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile TopAppBar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest/80 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-outline-variant lg:hidden">
        <span className="text-xl font-headline font-bold tracking-tighter text-tertiary">
          ECOpath
        </span>
        <span className="material-symbols-outlined text-outline cursor-pointer">
          account_circle
        </span>
      </header>

      {/* Desktop SideNav */}
      <SideNav />

      {/* Main content — offset by sidebar on desktop */}
      <main
        className="flex-1 pt-16 lg:pt-0 transition-all duration-300"
        style={{ paddingLeft: "var(--sidenav-w, 0px)" } as React.CSSProperties}
      >
        <div className="max-w-3xl mx-auto p-md lg:p-lg">
          {/* Header */}
          <div className="mb-lg">
            <h2 className="font-headline font-bold text-2xl text-on-background tracking-tight">
              Plan Your Day
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Connect your calendar and get optimized transit routes between
              events.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-lg">
            {/* Date input */}
            <div>
              <label
                htmlFor="plan-date"
                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-1"
              >
                Date
              </label>
              <input
                id="plan-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container-lowest text-on-background text-sm focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-tertiary"
              />
              {fieldError("date") && (
                <p className="text-xs text-error mt-1">
                  {fieldError("date")}
                </p>
              )}
            </div>

            {/* Home address input */}
            <div>
              <label
                htmlFor="home-address"
                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-1"
              >
                Home Address
              </label>
              <PlaceAutocompleteInput
                id="home-address"
                value={homeAddress}
                onChange={setHomeAddress}
                onPlaceSelect={(place) => {
                  if (place) {
                    setHomeAddress(place.formattedAddress);
                  }
                }}
                placeholder="Enter your home address"
                required
                label="Home Address"
                className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container-lowest text-on-background text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-tertiary"
              />
              {fieldError("home_address") && (
                <p className="text-xs text-error mt-1">
                  {fieldError("home_address")}
                </p>
              )}
            </div>

            {/* Google Calendar button */}
            <div>
              <button
                type="button"
                onClick={handleConnectCalendar}
                disabled={oauthLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded border border-outline-variant bg-surface-container-lowest text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  calendar_month
                </span>
                {oauthLoading
                  ? "Connecting…"
                  : sessionId
                    ? "Calendar Connected"
                    : "Connect Google Calendar"}
              </button>
              {oauthMessage && (
                <p className="text-xs text-error mt-1">{oauthMessage}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-tertiary text-on-tertiary font-semibold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Planning…" : "Plan My Day"}
            </button>
          </form>

          {/* Error display */}
          {error && (
            <div className="bg-error-container border border-error text-on-error-container rounded p-md text-sm mb-lg">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Loading state */}
          {loading && <DayPlanLoading />}

          {/* Results */}
          {result && !loading && <DayPlanResults result={result} />}

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant text-sm text-center gap-2">
              <span className="material-symbols-outlined text-4xl text-outline-variant">
                calendar_today
              </span>
              <p>Enter a date and address above to plan your day.</p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile BottomNav */}
      <nav className="lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container-lowest rounded-t-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-outline-variant">
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/">
          <span className="material-symbols-outlined mb-1">explore</span>Explore
        </a>
        <a className="flex flex-col items-center text-tertiary font-semibold text-[10px] uppercase tracking-widest" href="/plan-day">
          <span className="material-symbols-outlined mb-1">calendar_today</span>Plan Day
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/travel-history">
          <span className="material-symbols-outlined mb-1">history</span>History
        </a>
        <a className="flex flex-col items-center text-on-surface-variant font-semibold text-[10px] uppercase tracking-widest hover:text-tertiary" href="/leaderboard">
          <span className="material-symbols-outlined mb-1">leaderboard</span>Board
        </a>
      </nav>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function DayPlanLoading() {
  return (
    <div className="flex flex-col items-center text-center p-lg">
      <div className="w-16 h-16 bg-tertiary-fixed flex items-center justify-center rounded-full mb-md border-2 border-tertiary">
        <span className="material-symbols-outlined text-3xl text-tertiary">
          calendar_today
        </span>
      </div>
      <h3 className="font-headline font-semibold text-lg text-on-background mb-xs">
        Planning Your Day
      </h3>
      <p className="text-sm text-on-surface-variant mb-md">
        Fetching calendar events and optimizing transit routes.
      </p>
      <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mb-sm">
        <div className="bg-tertiary h-full w-2/3 rounded-full animate-pulse" />
      </div>
      <p className="text-xs font-medium text-tertiary">
        Evaluating routes between events…
      </p>
    </div>
  );
}

function DayPlanResults({ result }: { result: DayPlanResponse }) {
  return (
    <div className="space-y-6">
      {/* Summary totals bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon="eco"
          label="Total Emissions"
          value={`${(result.total_emissions_g / 1000).toFixed(2)} kg CO₂`}
        />
        <SummaryCard
          icon="payments"
          label="Total Cost"
          value={`$${result.total_cost_usd.toFixed(2)}`}
        />
        <SummaryCard
          icon="schedule"
          label="Transit Time"
          value={`${result.total_transit_min} min`}
        />
      </div>

      {/* Event timeline */}
      {result.events.length > 0 && (
        <section>
          <h3 className="font-headline font-semibold text-sm text-on-background uppercase tracking-widest mb-3">
            Events
          </h3>
          <div className="space-y-2">
            {result.events.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Transit windows */}
      {result.transit_windows.length > 0 && (
        <section>
          <h3 className="font-headline font-semibold text-sm text-on-background uppercase tracking-widest mb-3">
            Transit Windows
          </h3>
          <div className="space-y-3">
            {result.transit_windows.map((tw, i) => (
              <TransitWindowCard key={i} window={tw} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded p-3 text-center">
      <span className="material-symbols-outlined text-tertiary text-xl mb-1 block">
        {icon}
      </span>
      <p className="text-xs text-on-surface-variant uppercase tracking-widest">
        {label}
      </p>
      <p className="font-headline font-semibold text-sm text-on-background mt-0.5">
        {value}
      </p>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const startTime = formatTime(event.start);
  const endTime = formatTime(event.end);

  return (
    <div className="flex items-start gap-3 bg-surface-container-lowest border border-outline-variant rounded p-3">
      <span className="material-symbols-outlined text-tertiary text-lg mt-0.5">
        event
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-on-background truncate">
          {event.summary}
        </p>
        <p className="text-xs text-on-surface-variant">
          {startTime} – {endTime}
        </p>
        {event.location && (
          <p className="text-xs text-on-surface-variant truncate mt-0.5">
            <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">
              location_on
            </span>
            {event.location}
          </p>
        )}
      </div>
    </div>
  );
}

function TransitWindowCard({ window: tw }: { window: TransitWindow }) {
  const rec = tw.recommended;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-secondary text-lg">
          directions
        </span>
        <p className="text-xs text-on-surface-variant font-medium">
          {tw.from_event} → {tw.to_event}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-xs font-semibold uppercase">
          {rec.mode.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-on-surface-variant">
          {rec.duration_min} min
        </span>
      </div>

      <div className="flex gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">eco</span>
          {(rec.emissions_g / 1000).toFixed(2)} kg
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">
            payments
          </span>
          ${rec.cost_usd.toFixed(2)}
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">
            schedule
          </span>
          {tw.available_min} min available
        </span>
      </div>

      <p className="text-xs text-on-surface-variant mt-2">{rec.summary}</p>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
