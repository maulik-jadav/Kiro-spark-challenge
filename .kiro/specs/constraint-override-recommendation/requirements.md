# Requirements Document

## Introduction

When a user provides a free-text constraint (e.g., "I want to save money"), the Decision Agent LLM should have the authority to override the scoring engine's pre-selected recommendation and choose a different transit mode that better satisfies the constraint. Currently the LLM is instructed to "explain and justify" the pre-selected route, which means it rubber-stamps the scoring engine's pick even when the constraint directly conflicts with it. This feature grants the LLM override authority when a constraint is present, while preserving the current behavior (explain and justify the pre-selected mode) when no constraint is provided.

## Glossary

- **Decision_Agent**: The LLM-based reasoning component in `backend/agents/decision_agent.py` that produces an `AgentReasoning` response containing a recommended mode, summary, justification, and optional constraint analysis.
- **Scoring_Engine**: The deterministic, constraint-unaware module in `backend/core/scoring_engine.py` that ranks route options by priority (fastest, greenest, best_tradeoff) and selects a recommended mode.
- **Constraint**: A free-text string provided by the user via `RouteRequest.constraint` expressing a preference or requirement (e.g., "I want to save money", "Arrive by 10 AM", "avoid driving").
- **Pre_Selected_Mode**: The `recommended_mode` chosen by the Scoring_Engine and passed to the Decision_Agent as input.
- **Override**: The act of the Decision_Agent selecting a `recommended_mode` in its `AgentReasoning` output that differs from the Pre_Selected_Mode.
- **Fallback_Reasoning**: The deterministic code path in `_fallback_reasoning()` used when the LLM is unavailable or fails.
- **SYSTEM_PROMPT**: The base system prompt constant in `decision_agent.py` that instructs the LLM on its role and output format.
- **AgentReasoning**: The Pydantic response model containing `recommended_mode`, `summary`, `justification`, and `constraint_analysis`.

## Requirements

### Requirement 1: Constraint-Aware System Prompt

**User Story:** As a user with a constraint, I want the Decision Agent to be instructed that it may override the scoring engine's pick, so that my constraint is actually honored rather than ignored.

#### Acceptance Criteria

1. WHEN a non-empty Constraint is provided, THE Decision_Agent SHALL use a system prompt that instructs the LLM it may select a different mode from the available options if the Constraint warrants it.
2. WHEN a non-empty Constraint is provided, THE Decision_Agent system prompt SHALL state that the Constraint takes precedence over the Pre_Selected_Mode.
3. WHEN no Constraint is provided, THE Decision_Agent SHALL use a system prompt that instructs the LLM to explain and justify the Pre_Selected_Mode, preserving current behavior.
4. THE Decision_Agent system prompt SHALL instruct the LLM to select only from modes present in the provided route options.

### Requirement 2: LLM Override Authority

**User Story:** As a user who says "I want to save money," I want the system to recommend the cheapest mode even if the scoring engine picked a faster but more expensive one, so that my stated preference is respected.

#### Acceptance Criteria

1. WHEN a Constraint is provided, THE Decision_Agent SHALL permit the LLM to return a `recommended_mode` in AgentReasoning that differs from the Pre_Selected_Mode.
2. WHEN a Constraint is provided and the LLM selects a mode that differs from the Pre_Selected_Mode, THE Decision_Agent SHALL include in the `constraint_analysis` field an explanation of why the Override was made.
3. WHEN a Constraint is provided and the LLM determines the Pre_Selected_Mode already satisfies the Constraint, THE Decision_Agent SHALL return the Pre_Selected_Mode as the `recommended_mode`.
4. THE Decision_Agent SHALL return a `recommended_mode` that is one of the modes present in the provided route options.

### Requirement 3: No-Constraint Behavior Preservation

**User Story:** As a user who does not provide a constraint, I want the system to continue recommending the scoring engine's pick, so that the existing deterministic behavior is unchanged.

#### Acceptance Criteria

1. WHEN no Constraint is provided, THE Decision_Agent LLM SHALL return the Pre_Selected_Mode as the `recommended_mode` in AgentReasoning.
2. WHEN no Constraint is provided, THE Decision_Agent SHALL produce a `constraint_analysis` value of null in AgentReasoning.

### Requirement 4: Override Indication in Response

**User Story:** As a frontend consumer, I want to know whether the final recommendation was overridden by a constraint, so that I can display appropriate context to the user.

#### Acceptance Criteria

1. THE AgentReasoning model SHALL include a boolean field `constraint_override` that indicates whether the Decision_Agent selected a mode different from the Pre_Selected_Mode due to a Constraint.
2. WHEN the Decision_Agent returns a `recommended_mode` that differs from the Pre_Selected_Mode and a Constraint is present, THE Decision_Agent SHALL set `constraint_override` to true.
3. WHEN the Decision_Agent returns a `recommended_mode` equal to the Pre_Selected_Mode, THE Decision_Agent SHALL set `constraint_override` to false.
4. WHEN the Fallback_Reasoning path is used, THE Decision_Agent SHALL set `constraint_override` to false.

### Requirement 5: Fallback Reasoning Unchanged

**User Story:** As a system operator, I want the deterministic fallback to remain constraint-unaware, so that the system always returns a valid response even when the LLM is unavailable.

#### Acceptance Criteria

1. WHEN the LLM API key is missing, THE Decision_Agent SHALL use Fallback_Reasoning regardless of whether a Constraint is provided.
2. WHEN the LLM call fails, THE Decision_Agent SHALL use Fallback_Reasoning regardless of whether a Constraint is provided.
3. THE Fallback_Reasoning path SHALL continue to use the Pre_Selected_Mode from the Scoring_Engine and SHALL set `constraint_override` to false.

### Requirement 6: Orchestrator Passthrough

**User Story:** As a developer, I want the orchestrator to pass the pre-selected mode and constraint to the Decision Agent without modification, so that the override decision is made entirely within the Decision Agent.

#### Acceptance Criteria

1. THE Orchestrator SHALL pass the Constraint from the RouteRequest to the Decision_Agent `decide()` function without modification.
2. THE Orchestrator SHALL pass the Pre_Selected_Mode from the Scoring_Engine to the Decision_Agent `decide()` function without modification.
3. THE Orchestrator SHALL use the `recommended_mode` from the AgentReasoning response (which may differ from the Pre_Selected_Mode) as the final recommendation.

### Requirement 7: Valid Mode Enforcement

**User Story:** As a system operator, I want the Decision Agent to reject LLM responses that recommend a mode not in the available options, so that the system never surfaces an impossible route.

#### Acceptance Criteria

1. IF the LLM returns a `recommended_mode` that is not present in the provided route options, THEN THE Decision_Agent SHALL fall back to the Pre_Selected_Mode and set `constraint_override` to false.
2. IF the LLM returns a response that cannot be parsed as valid JSON, THEN THE Decision_Agent SHALL use Fallback_Reasoning.
