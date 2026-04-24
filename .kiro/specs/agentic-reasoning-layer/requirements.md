# Requirements: Agentic Reasoning Layer (Phase 1.2)

## Introduction

This phase builds the multi-agent evaluation and route negotiation system. It introduces the Decision Agent, which compares route outputs, applies user constraints (e.g., "Arrive by 10 AM"), ranks options using weighted scoring, and generates natural language justifications for recommendations. It also formalizes the multi-agent pipeline orchestration so that the Routing Agent, Emissions Agent, and Decision Agent operate as a coordinated workflow.

## Glossary

- **Route_Planner**: The PathProject backend system responsible for computing, analyzing, and recommending routes
- **Routing_Agent**: The agent responsible for fetching all possible paths and transit modes between two points
- **Emissions_Agent**: The agent responsible for computing carbon cost (g CO2e) for each route option using EPA/IPCC/FTA emission factors
- **Decision_Agent**: The agent responsible for comparing route options, applying user constraints, ranking results, and generating natural language justifications
- **Route_Option**: A complete route from origin to destination via a specific primary transit mode, containing one or more segments
- **Raw_Route_Result**: The intermediate data structure returned by the Maps_Client before emissions analysis
- **User_Constraint**: A condition specified by the user that restricts route selection (e.g., arrival deadline, maximum cost, preferred modes)
- **Tradeoff_Summary**: A structured comparison between two route options quantifying differences in emissions, time, and cost
- **Transit_Mode**: One of the 11 supported transportation modes

## Dependencies

- Requires Phase 1.1 (core-route-mvp) to be complete — the Routing Agent and Emissions Agent must be functional.

## Requirements

### Requirement 1: Decision Agent Constraint-Based Evaluation

**User Story:** As a user, I want to specify constraints like "arrive by 10 AM" or "spend under $5", so that the system recommends routes that fit my real-world needs.

#### Acceptance Criteria

1. WHEN a User_Constraint specifying an arrival deadline is provided, THE Decision_Agent SHALL exclude all Route_Options whose total duration exceeds the available time window
2. WHEN a User_Constraint specifying a maximum cost is provided, THE Decision_Agent SHALL exclude all Route_Options whose total cost exceeds the specified maximum
3. WHEN a User_Constraint specifying preferred Transit_Modes is provided, THE Decision_Agent SHALL prioritize Route_Options using those modes in the ranking
4. WHEN multiple User_Constraints are provided, THE Decision_Agent SHALL apply all constraints conjunctively, excluding options that violate any single constraint
5. IF no Route_Options satisfy all User_Constraints, THEN THE Decision_Agent SHALL return the closest viable options with an explanation of which constraints could not be met
6. THE Decision_Agent SHALL rank remaining Route_Options by a weighted score combining emissions, duration, and cost based on user preference weights

---

### Requirement 2: Tradeoff Analysis and Natural Language Justification

**User Story:** As a user, I want the system to explain tradeoffs between route options in plain language, so that I understand why a particular route is recommended.

#### Acceptance Criteria

1. THE Decision_Agent SHALL generate a Tradeoff_Summary for each pair of the top-ranked Route_Option and every alternative Route_Option
2. WHEN comparing two Route_Options, THE Decision_Agent SHALL compute the difference in emissions (kg CO2e), duration (minutes), and cost (USD)
3. THE Decision_Agent SHALL produce a natural language justification string for the recommended Route_Option that references specific tradeoff values
4. WHEN the recommended route has higher duration than an alternative, THE Decision_Agent SHALL include the time penalty in the justification (e.g., "saves 3.2 kg CO2 for a 4-minute longer trip")
5. THE Decision_Agent SHALL ensure every justification string is non-empty and contains at least one quantified tradeoff value

---

### Requirement 3: Multi-Agent Pipeline Orchestration

**User Story:** As a developer, I want the routing, emissions, and decision agents to operate as a coordinated pipeline, so that each agent's output feeds cleanly into the next.

#### Acceptance Criteria

1. THE Route_Planner SHALL execute the pipeline in order: Routing_Agent, then Emissions_Agent, then Decision_Agent
2. THE Emissions_Agent SHALL produce exactly one Route_Option for each Raw_Route_Result received from the Routing_Agent
3. THE Decision_Agent SHALL receive all Route_Options produced by the Emissions_Agent without data loss
4. IF the Routing_Agent returns an empty list of routes, THEN THE Route_Planner SHALL return an empty Route_Comparison with a descriptive message
5. IF the Emissions_Agent encounters an unknown Transit_Mode in a segment, THEN THE Emissions_Agent SHALL fall back to walking emission factors for that segment

---

### Requirement 4: API Endpoint for Constrained Route Planning

**User Story:** As a frontend developer, I want an API endpoint that accepts user constraints, so that I can build the agentic recommendation interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/plan-route-constrained endpoint that accepts origin, destination, optional modes, and a list of User_Constraints
2. WHEN User_Constraints include an arrival_by timestamp, THE Route_Planner SHALL pass the constraint to the Decision_Agent for filtering
3. WHEN User_Constraints include a max_cost value, THE Route_Planner SHALL pass the constraint to the Decision_Agent for filtering
4. THE Route_Planner SHALL return a response containing ranked Route_Options, the recommended Route_Option, and a natural language justification string
5. IF no constraints are provided, THEN THE Route_Planner SHALL behave identically to the unconstrained plan-route endpoint
