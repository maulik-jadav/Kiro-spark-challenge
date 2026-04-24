Below is a solid implementation plan for the commute itinerary planner.

## App concept

Build a route-planning app where the user enters:

* Point A
* Point B
* Required arrival time
* Transportation preferences, such as driving, walking, biking, public transit, rideshare, or mixed mode
* Priority preference:

  * Fastest valid route
  * Lowest emissions
  * Lowest cost
  * Balanced recommendation

The system generates multiple route options, evaluates them using separate “agents,” and then uses an LLM to explain the best option for each priority.

Google Maps Platform is suitable for the routing layer because the Routes API supports route calculation, travel time, distance, traffic-aware routing, and multiple travel modes. Google’s Compute Route Matrix can compare travel times and distances across route options or origin/destination combinations. ([Google for Developers][1])

---

# 1. Core user flow

## Step 1: User enters trip request

Example:

```json
{
  "origin": "Tempe, AZ",
  "destination": "Phoenix Sky Harbor Airport",
  "arrivalTime": "2026-04-24T09:00:00-07:00",
  "preferredModes": ["DRIVE", "TRANSIT", "BICYCLE"],
  "vehicle": {
    "type": "gasoline",
    "mpg": 28
  }
}
```

## Step 2: App generates route candidates

The backend asks Google Routes API for route options such as:

* Driving route 1
* Driving route 2
* Transit route
* Bike route
* Walk + transit route
* Park-and-ride route, if supported later

The Routes API can return route distance, duration, travel mode, and transit-specific details such as stops, departure/arrival time, line details, and transfer information. ([Google for Developers][2])

## Step 3: Agents evaluate the options

Each agent scores the same set of routes differently.

## Step 4: Aggregator ranks the routes

The system returns:

* Best fastest route
* Best low-emission route
* Best low-cost route
* Best balanced route
* Explanation from the LLM

## Step 5: User sees itinerary

Example output:

> “Leave at 8:12 AM. Take Route A. Estimated arrival: 8:52 AM. This is the best low-cost route because it avoids tolls and uses less fuel than the highway route, while still arriving before your required time.”

---

# 2. Agent architecture

You can model this as a swarm of specialized scoring agents.

## Agent 1: Time Agent

Purpose: find the fastest route that still arrives before the required arrival time.

Inputs:

* Estimated duration
* Traffic-adjusted duration
* Arrival deadline
* Departure time
* Travel mode

Output:

```json
{
  "routeId": "route_1",
  "timeScore": 0.94,
  "validArrival": true,
  "estimatedArrival": "08:52"
}
```

Scoring idea:

```text
timeScore = 1 - normalized(duration)
```

Reject routes that arrive late unless no valid route exists.

---

## Agent 2: Environmental Impact Agent

Purpose: estimate emissions for each route.

For driving, estimate CO₂ using distance and vehicle fuel efficiency. EPA states that a typical passenger vehicle emits about 4.6 metric tons of CO₂ per year, though actual emissions vary by fuel type, fuel economy, and miles driven. EPA also provides official emissions factor resources for greenhouse gas reporting. ([US EPA][3])

Basic formula:

```text
fuel_used_gallons = distance_miles / mpg
co2_grams = fuel_used_gallons * 8887
```

For transit, biking, and walking:

```text
walking = 0 direct tailpipe emissions
biking = 0 direct tailpipe emissions
transit = estimated emissions per passenger-mile
driving = based on vehicle mpg
EV = based on kWh/mile and electricity grid factor
```

Output:

```json
{
  "routeId": "route_2",
  "emissionsGramsCO2": 1450,
  "environmentScore": 0.88
}
```

---

## Agent 3: Cost Agent

Purpose: estimate user cost.

Cost inputs:

* Gas cost
* Distance
* MPG
* Parking estimate
* Toll estimate
* Transit fare
* Rideshare estimate, if added later

Basic driving formula:

```text
fuelCost = (distanceMiles / mpg) * gasPricePerGallon
totalCost = fuelCost + tolls + parking
```

For MVP, use:

```text
drivingCost = fuel cost only
transitCost = static fare estimate
walking/bikingCost = 0
```

Later, add:

* Real gas prices
* Parking API
* Toll data
* Public transit fare data
* Rideshare estimates

---

## Agent 4: Convenience / Practicality Agent

I would add this as the fourth agent.

Purpose: prevent the app from recommending unrealistic options.

It scores:

* Number of transfers
* Walking distance
* Weather exposure
* Route complexity
* Safety or lighting, if data is available later
* Reliability buffer
* User preferences

Example:

```json
{
  "routeId": "route_3",
  "convenienceScore": 0.71,
  "reasons": [
    "Requires one transfer",
    "Includes 0.4 miles of walking",
    "Has 12-minute arrival buffer"
  ]
}
```

This agent is important because the cheapest or lowest-emission route may be unpleasant or unreliable.

---

# 3. Recommended backend architecture

## Frontend

Use:

* React / Next.js
* Google Maps JavaScript API
* Route visualization with polylines
* Priority selector
* Route comparison cards

Google’s Maps JavaScript API supports dynamic and customized map experiences for web apps. ([Google for Developers][4])

Main screens:

1. Trip input screen
2. Route comparison screen
3. Route detail screen
4. Explanation panel

---

## Backend

Use:

* Node.js / Express, or ASP.NET Core if you want to stay in your existing stack
* PostgreSQL or Azure SQL
* Redis for caching route results
* Background job queue for route evaluation if needed

Suggested services:

```text
/api/trips
/api/routes/compare
/api/routes/explain
/api/user/preferences
```

---

## Database tables

### Users

```text
id
email
default_vehicle_id
created_at
```

### Vehicles

```text
id
user_id
fuel_type
mpg
kwh_per_mile
default_gas_price
```

### Trips

```text
id
user_id
origin_place_id
destination_place_id
arrival_time
created_at
```

### RouteOptions

```text
id
trip_id
mode
distance_meters
duration_seconds
estimated_arrival
polyline
raw_google_response
```

### RouteScores

```text
id
route_option_id
time_score
emissions_score
cost_score
convenience_score
balanced_score
estimated_cost
estimated_emissions_grams
```

### LLMExplanations

```text
id
trip_id
route_option_id
priority_type
explanation
created_at
```

---

# 4. Scoring model

Normalize all scores between `0` and `1`.

Example:

```text
finalScore =
  timeWeight * timeScore +
  emissionsWeight * emissionsScore +
  costWeight * costScore +
  convenienceWeight * convenienceScore
```

## Preset weights

### Fastest

```json
{
  "time": 0.70,
  "emissions": 0.10,
  "cost": 0.10,
  "convenience": 0.10
}
```

### Lowest emissions

```json
{
  "time": 0.20,
  "emissions": 0.60,
  "cost": 0.10,
  "convenience": 0.10
}
```

### Lowest cost

```json
{
  "time": 0.20,
  "emissions": 0.10,
  "cost": 0.60,
  "convenience": 0.10
}
```

### Balanced

```json
{
  "time": 0.35,
  "emissions": 0.25,
  "cost": 0.25,
  "convenience": 0.15
}
```

---

# 5. LLM explanation layer

The LLM should not calculate the route. It should explain the route based on structured data from your agents.

Send the LLM a compact summary like this:

```json
{
  "userGoal": "Arrive by 9:00 AM",
  "selectedPriority": "lowest emissions",
  "recommendedRoute": {
    "mode": "TRANSIT",
    "departureTime": "8:05 AM",
    "arrivalTime": "8:47 AM",
    "durationMinutes": 42,
    "estimatedCost": 2.00,
    "estimatedEmissionsGrams": 620,
    "transfers": 1
  },
  "alternatives": [
    {
      "mode": "DRIVE",
      "durationMinutes": 24,
      "estimatedCost": 3.80,
      "estimatedEmissionsGrams": 3100
    },
    {
      "mode": "BICYCLE",
      "durationMinutes": 58,
      "estimatedCost": 0,
      "estimatedEmissionsGrams": 0
    }
  ]
}
```

Prompt:

```text
Explain why the recommended route is best for the selected priority.
Use only the provided route data.
Mention tradeoffs clearly.
Do not invent traffic, cost, safety, or emissions details.
Keep the explanation under 120 words.
```

Example LLM output:

> The transit route is the best low-emission option that still arrives on time. It arrives at 8:47 AM, giving a 13-minute buffer before the 9:00 AM deadline. Although driving is faster at 24 minutes, it produces much higher estimated emissions. Biking has the lowest emissions, but it takes 58 minutes and has less arrival buffer. Transit gives the best balance for this priority because it greatly reduces emissions while keeping the trip reliable.

---

# 6. MVP implementation plan

## Phase 1: Basic route comparison

Build:

* Origin/destination input
* Arrival time input
* Google route lookup
* Driving, walking, biking, and transit options
* Display route duration, distance, and ETA

APIs:

* Google Maps JavaScript API
* Google Routes API
* Places API for autocomplete

Places API supports Place IDs, which are useful for reliably identifying origins and destinations instead of storing raw addresses. ([Google for Developers][5])

---

## Phase 2: Agent scoring engine

Build backend functions:

```text
TimeAgent
EmissionAgent
CostAgent
ConvenienceAgent
RouteAggregator
```

Return:

```json
{
  "fastest": {},
  "lowestEmission": {},
  "lowestCost": {},
  "balanced": {}
}
```

---

## Phase 3: LLM explanation

Build:

```text
ExplanationService
```

Rules:

* LLM receives only structured route data
* LLM does not call Google Maps directly
* LLM does not invent missing values
* Backend stores explanation for reuse

---

## Phase 4: User preferences

Add:

* Default vehicle MPG
* Fuel type
* Max walking distance
* Avoid tolls
* Prefer transit
* Prefer lower emissions
* Accessibility needs
* Saved home/work/school locations

---

## Phase 5: Better environmental and cost modeling

Add:

* Vehicle-specific MPG
* EV support
* Gas price lookup
* Transit fare lookup
* Parking estimate
* Toll estimate
* Emissions history dashboard

---

# 7. Suggested tech stack

Since you already work with React, .NET, Azure, and SQL, this stack fits well:

```text
Frontend:
React or Next.js
Google Maps JavaScript API

Backend:
ASP.NET Core Web API or Azure Functions

Database:
Azure SQL

Cache:
Azure Cache for Redis

LLM:
OpenAI API or Azure OpenAI

Maps:
Google Maps Platform Routes API
Google Places API
Google Maps JavaScript API

Deployment:
Azure Static Web Apps for frontend
Azure Functions or App Service for backend
GitHub Actions for CI/CD
```

---

# 8. Main system components

```text
User Interface
  -> Trip Input Form
  -> Map Display
  -> Route Cards
  -> Explanation Panel

Backend API
  -> Route Request Controller
  -> Google Maps Service
  -> Agent Orchestrator
  -> Scoring Engine
  -> LLM Explanation Service
  -> Database Service

External APIs
  -> Google Routes API
  -> Google Places API
  -> LLM API
  -> Optional fuel/parking/transit cost APIs
```

---

# 9. Good MVP feature set

For the first version, keep it focused:

1. User enters origin, destination, and arrival deadline.
2. App fetches route options from Google.
3. App compares routes by:

   * Time
   * Estimated emissions
   * Estimated fuel cost
   * Convenience
4. App shows four recommendations:

   * Fastest
   * Greenest
   * Cheapest
   * Balanced
5. LLM explains each recommendation.
6. User can save vehicle MPG and preferred travel mode.

That is enough for a strong prototype and a clear portfolio project.

[1]: https://developers.google.com/maps/documentation/routes?utm_source=chatgpt.com "Google Maps Platform Documentation | Routes API | Google for Developers"
[2]: https://developers.google.com/maps/documentation/routes/compute-route-over?utm_source=chatgpt.com "Compute Routes Overview | Routes API | Google for Developers"
[3]: https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle?utm_source=chatgpt.com "Greenhouse Gas Emissions from a Typical Passenger Vehicle"
[4]: https://developers.google.com/maps/documentation/javascript/?utm_source=chatgpt.com "Google Maps Platform Documentation | Maps JavaScript API | Google for ..."
[5]: https://developers.google.com/maps/documentation/places/web-service/overview?utm_source=chatgpt.com "Overview | Places API | Google for Developers"
