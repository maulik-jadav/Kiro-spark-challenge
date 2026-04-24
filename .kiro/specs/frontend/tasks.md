# Tasks: PathProject Frontend

## Task List

- [x] 1. Scaffold Next.js project
  - [x] 1.1 Run `create-next-app` inside `frontend/` with TypeScript, Tailwind CSS, and App Router
  - [x] 1.2 Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to `frontend/.env.local` from root `.env`
  - [x] 1.3 Configure `next.config.js` rewrites to proxy `/api/v1/:path*` → `http://localhost:8000/api/v1/:path*`

- [x] 2. Define shared TypeScript types
  - [x] 2.1 Create `frontend/src/types/api.ts` with `TransitMode` enum, `RouteSegment`, `RouteOption`, and `RouteComparison` interfaces mirroring the backend schemas

- [x] 3. Build the API client
  - [x] 3.1 Create `frontend/src/lib/api.ts` with a `planRoute(origin, destination, modes)` function that POSTs to `/api/v1/plan-route` and returns `RouteComparison`

- [x] 4. Build the Trip Input Form component
  - [x] 4.1 Create `frontend/src/components/TripForm.tsx` with origin/destination inputs and a mode multi-select
  - [x] 4.2 Add form validation (non-empty origin and destination)
  - [x] 4.3 Emit `onSubmit` with `{ origin, destination, modes }` to parent

- [x] 5. Build the Route Card component
  - [x] 5.1 Create `frontend/src/components/RouteCard.tsx` that accepts a `RouteOption` and badge flags (`isGreenest`, `isFastest`, `isCheapest`)
  - [x] 5.2 Display mode, distance, duration, emissions, and cost in the card header
  - [x] 5.3 Implement expand/collapse to show the segments table (keyboard accessible)

- [x] 6. Build the Results Panel component
  - [x] 6.1 Create `frontend/src/components/ResultsPanel.tsx` that accepts a `RouteComparison` and renders a list of `RouteCard` components
  - [x] 6.2 Pass `isGreenest`, `isFastest`, `isCheapest` flags by comparing each option's mode to `comparison.greenest`, `comparison.fastest`, `comparison.cheapest`
  - [x] 6.3 Render the `savings_vs_driving_kg` callout when present and positive

- [x] 7. Build the Map component
  - [x] 7.1 Create `frontend/src/components/MapView.tsx` using `@vis.gl/react-google-maps` (or `@react-google-maps/api`) to embed the map
  - [x] 7.2 Place origin and destination markers when coordinates or address strings are provided
  - [x] 7.3 Wrap in an error boundary / conditional render so the app works without a valid API key

- [x] 8. Wire up the main page
  - [x] 8.1 Update `frontend/src/app/page.tsx` to compose `TripForm`, `MapView`, and `ResultsPanel`
  - [x] 8.2 Manage loading, error, and result state in the page component
  - [x] 8.3 Pass origin/destination strings to `MapView` after a successful query

- [x] 9. Style and polish
  - [x] 9.1 Add a header with the "PathProject" brand name
  - [x] 9.2 Apply Tailwind classes for the green/blue/yellow badge color scheme
  - [x] 9.3 Verify layout is usable at 320 px viewport width
