# Requirements Document

## Introduction

This feature injects the user-provided constraint (from `RouteRequest.constraint`) into the Decision Agent's LLM system prompt, making it a first-class instruction for the reasoning model. Currently the constraint is only appended to the user message via `_build_user_prompt()`, while `SYSTEM_PROMPT` in `backend/agents/decision_agent.py` is static. By elevating the constraint into the system prompt, the LLM treats it as authoritative context before generating its recommendation, improving constraint adherence in the reasoning output.

## Glossary

- **Decision_Agent**: The LLM-backed reasoning layer in `backend/agents/decision_agent.py` that evaluates route options and produces an `AgentReasoning` response with a recommendation, summary, justification, and constraint analysis.
- **System_Prompt**: The `system` role message sent to the LLM in the chat completions API call. It sets the model's persona and instructions before any user content is processed.
- **User_Prompt**: The `user` role message sent to the LLM containing route data, the pre-selected recommendation, and contextual information.
- **Constraint**: An optional free-text string provided by the user via `RouteRequest.constraint` (e.g., "Arrive by 10 AM", "Budget under $5", "Avoid highways") that expresses a preference or requirement for the route recommendation.
- **Constraint_System_Prompt**: A dynamically constructed system prompt that includes the base system instructions plus the user's constraint as an authoritative instruction.
- **Fallback_Reasoning**: The deterministic recommendation path used when no LLM API key is configured or when the LLM call fails.

## Requirements

### Requirement 1: Dynamic System Prompt Construction with Constraint

**User Story:** As a user providing a constraint, I want the constraint to be included in the LLM's system prompt, so that the reasoning model treats it as a first-class instruction when generating its recommendation.

#### Acceptance Criteria

1. WHEN a constraint is provided, THE Decision_Agent SHALL construct a Constraint_System_Prompt by appending the constraint text to the base System_Prompt as an authoritative instruction section.
2. WHEN no constraint is provided, THE Decision_Agent SHALL use the base System_Prompt without modification.
3. WHEN a constraint is provided, THE Decision_Agent SHALL include the constraint in both the Constraint_System_Prompt and the User_Prompt to ensure the model has the constraint in both instruction and data context.
4. THE Decision_Agent SHALL preserve the existing base System_Prompt content, including the JSON response format specification, when constructing the Constraint_System_Prompt.

### Requirement 2: Constraint Formatting in System Prompt

**User Story:** As a developer, I want the constraint to be clearly delineated within the system prompt, so that the LLM can distinguish between base instructions and the user's constraint.

#### Acceptance Criteria

1. WHEN a constraint is injected into the System_Prompt, THE Decision_Agent SHALL separate the constraint from the base instructions using a clearly labeled section header.
2. THE Decision_Agent SHALL prefix the constraint with a directive that instructs the model to prioritize the constraint when analyzing trade-offs and generating the constraint_analysis field.
3. WHEN the constraint text is empty after trimming whitespace, THE Decision_Agent SHALL treat the constraint as absent and use the unmodified base System_Prompt.

### Requirement 3: System Prompt Construction is Pure

**User Story:** As a developer, I want the system prompt construction to be a testable pure function, so that I can verify prompt assembly without making LLM calls.

#### Acceptance Criteria

1. THE Decision_Agent SHALL expose a function that accepts the base system prompt string and an optional constraint string and returns the assembled system prompt string.
2. WHEN the function receives the same base prompt and constraint inputs, THE Decision_Agent SHALL return an identical output string (deterministic behavior).
3. FOR ALL valid constraint strings, assembling then extracting the constraint from the Constraint_System_Prompt SHALL produce the original constraint text (round-trip property).

### Requirement 4: Constraint Passthrough in Orchestrator

**User Story:** As a user, I want my constraint to flow through the orchestrator unchanged, so that the Decision Agent receives exactly what I typed.

#### Acceptance Criteria

1. THE Orchestrator SHALL pass the constraint string from the RouteRequest to the Decision_Agent without modification.
2. WHEN the constraint is None, THE Orchestrator SHALL pass None to the Decision_Agent.

### Requirement 5: Fallback Reasoning Unaffected

**User Story:** As a user, I want the fallback reasoning path to continue working when no LLM API key is available, so that the system remains functional regardless of the constraint injection feature.

#### Acceptance Criteria

1. WHEN the LLM API key is missing, THE Decision_Agent SHALL use Fallback_Reasoning regardless of whether a constraint is provided.
2. WHEN the LLM call fails, THE Decision_Agent SHALL use Fallback_Reasoning regardless of whether a constraint is provided.
3. THE Fallback_Reasoning path SHALL remain unchanged by this feature and SHALL NOT attempt to interpret or process the constraint in the system prompt.
