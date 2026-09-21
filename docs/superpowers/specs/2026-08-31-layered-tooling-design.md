# Layered Tooling Design

**Date:** 2026-08-31
**Status:** Approved for implementation planning

## Summary

Zoo-Code can expose hundreds of built-in, MCP, and Roo custom tool definitions to a model. Their names, descriptions, and JSON schemas consume substantial request context before the model uses any of them. This design adds an opt-in **Layered Tooling** experiment that replaces the model-visible catalog with three stable tools:

- `search` discovers available tools through compact results.
- `documentation` returns the complete description and input schema for one selected tool.
- `execute` invokes one selected tool through its existing execution path.

Layered Tooling changes discovery and model-facing serialization only. Underlying tools must retain their existing validation, approval, UI, telemetry, execution, and result behavior.

## Goals

1. Reduce tool-definition context usage when many tools are available.
2. Cover built-in native tools, dynamically discovered MCP tools, and Roo custom tools through one discovery interface.
3. Preserve the observable behavior and security boundaries of every underlying tool.
4. Preserve mode restrictions, MCP server allowlists, disabled-tool settings, model tool customization, and experiment gates.
5. Keep existing behavior unchanged unless the user enables the experiment.
6. Prevent tool-protocol changes in the middle of a task or when a task is resumed.
7. Provide a visible per-task indication of whether direct or layered tooling is active.

## Non-Goals

- Reimplementing existing tool handlers in a universal executor.
- Running model-written JavaScript or supporting multi-tool batch execution in the first version.
- Changing auto-approval rules or adding a second gateway approval.
- Changing existing underlying result-size policies.
- Fixing the unrelated webview blanking or long-running-task crash issues.
- Removing the direct tool protocol.

## User Experience and Rollout

Add a **Layered Tooling** toggle to the Experimental settings tab. It defaults to off. When off, Zoo-Code builds and exposes tools exactly as it does today.

The setting applies only when a new task is created. The task snapshots the selected protocol as one of:

- `direct`
- `layered`

The snapshot is persisted in task history/metadata and restored when the task is resumed. Changing the global experiment does not alter active or historical tasks. Legacy tasks that lack protocol metadata use `direct` for backward compatibility.

The active task header displays a compact localized **Layered tools** or **Direct tools** badge near existing task metadata. The badge is informational and never changes the experiment.

## Considered Architectures

### 1. Adapter Registry with Existing-Handler Delegation — Selected

Build the normal allowed tool catalog internally, adapt each entry into a layered registry, and expose only three gateway definitions. `execute` resolves a registry entry and delegates to the existing handler path.

This approach minimizes behavioral drift because mature validation, approvals, status rendering, output formatting, telemetry, and restrictions remain authoritative.

### 2. Synthetic Re-entry Through the Assistant Parser

Have `execute` manufacture a nested tool call and feed it back through the current assistant-message parser.

This avoids some explicit dispatch plumbing but creates nested tool-call IDs, history-pairing ambiguity, recursion hazards, and difficult streaming behavior. It was rejected.

### 3. New Universal Executor

Reimplement native, MCP, and custom execution behind one gateway service.

This creates a conceptually uniform service but duplicates existing handlers and is likely to regress approvals, UI behavior, output handling, and security checks. It was rejected.

## Architecture

### Task Protocol Snapshot

The task owns an immutable `toolProtocol`. New tasks derive it from the Layered Tooling experiment. Resumed tasks derive it from persisted task metadata. The value is passed through task creation, history creation, persistence, state hydration, and subtask creation.

Subtasks are new tasks and snapshot the global setting at their own creation unless an implementation invariant requires inheriting the parent protocol to preserve delegation history. The implementation plan must resolve this detail by tracing current subtask task-creation and history behavior; it must not permit a protocol change within a single task.

### Allowed Tool Catalog

The current build pipeline remains authoritative:

1. Build native tools.
2. Resolve the task mode.
3. Apply native mode and experiment filtering.
4. Apply allowed MCP server filtering.
5. Build and filter dynamic MCP tools.
6. Load experiment-enabled Roo custom tools.
7. Apply model include/exclude customization and aliases.

In direct tasks, the resulting definitions continue to be returned to the provider.

In layered tasks, the filtered definitions are transformed into an internal registry. The provider receives only `search`, `documentation`, and `execute`.

Filtering must happen before registry construction. Discovery must never reveal a disabled or disallowed tool, and execution must revalidate current availability before dispatch.

### Layered Registry

Each registry entry has a focused contract containing at least:

- Stable layered ID.
- Display name.
- Source kind: native, MCP, or custom.
- Source metadata, including MCP server name where applicable.
- Canonical callable name.
- Complete description.
- Normalized input schema.
- Execution adapter metadata needed to reach the existing handler.
- Semantic flags required for isolation or terminal behavior.

Readable IDs use these forms:

- `native:<tool-name>`
- `mcp:<server-name>:<tool-name>`
- `custom:<tool-name>`

ID segments use deterministic escaping or normalization. If normalization creates a collision, deterministic suffixes disambiguate entries. Given the same allowed catalog, IDs and ordering must remain stable across requests and restarts.

The three gateway tools must not appear as registry targets, preventing recursive gateway calls.

Registry construction should be isolated from provider serialization and execution dispatch so it can be tested independently.

## Gateway Tool Contracts

### `search`

`search` is read-only and approval-free.

Input:

- Optional `query` string.
- Optional bounded `limit` for non-empty queries.

Behavior with a non-empty query:

- Rank across stable ID, display name, source/server metadata, and description.
- Use deterministic tie-breaking.
- Return a compact bounded list with stable ID, display name, and source.
- Default to 25 matches and enforce a hard maximum of 50. The default can be adjusted by the user in Experimental settings, and the model may request a lower per-call limit.
- Do not return complete descriptions or schemas.

Behavior with an absent or empty query:

- Return all currently available stable IDs and display names.
- Omit descriptions and schemas.
- Use deterministic source/name ordering.
- Enforce a defensive response-byte ceiling. If an extreme catalog exceeds the ceiling, include a deterministic truncation marker and instructions to provide a query.

### `documentation`

`documentation` is read-only and approval-free.

Input:

- Exactly one stable `tool_id`.

Output:

- Stable ID and display name.
- Source metadata.
- Complete tool description.
- Original normalized input schema.
- Concise instructions to call `execute` with the same ID and an argument object matching the schema.

Unknown or stale IDs return a structured error and compact suggestions. They must not dump the full catalog. Description/schema output uses a defensive byte ceiling and explicitly marks truncation.

### `execute`

`execute` invokes exactly one underlying tool in the first version.

Input:

- Required `tool_id`.
- Optional `arguments` object, depending on the selected schema.

Execution steps:

1. Validate the outer envelope.
2. Rebuild or refresh the currently allowed registry.
3. Resolve the stable ID.
4. Reject stale, unavailable, or newly forbidden entries.
5. Require `arguments` to be an object when present.
6. Reconstruct the underlying native, MCP, or custom invocation.
7. Delegate to the current handler and callback path.
8. Return the underlying handler result without introducing a second result-formatting policy.

The outer provider tool-call ID remains the ID used for API history pairing. Internally, usage/error telemetry and UI labels identify the underlying operation.

## Behavior Preservation

Layered `execute` is a transparent envelope, not a new approval boundary. It forwards the existing callback set to the underlying handler. The underlying path remains responsible for:

- Parameter validation.
- Consecutive-mistake tracking.
- Mode and server defense-in-depth checks.
- Auto-approval and user approval.
- Ask/say UI rows and execution status.
- Checkpoints where applicable.
- Images and resource links.
- Error handling.
- Tool usage and failure telemetry.
- Tool-result formatting.

MCP execution must continue through the existing MCP validation and invocation behavior rather than calling `McpHub.callTool()` directly from the gateway. Roo custom tools must likewise retain their current runner and experiment gate.

## Streaming and Partial Calls

The gateway never executes a partial outer tool call.

While an `execute` call streams:

- Show a generic layered-execute pending state until the stable ID can be resolved safely.
- Once the target ID and relevant arguments stabilize, reuse the underlying partial presentation behavior where practical.
- Do not create nested provider-visible tool IDs.
- Do not emit a final result until the complete outer call is handled.

Malformed or changing streamed IDs must fail through the completed-call validation path rather than triggering speculative execution.

## Isolation and Terminal Semantics

The system must inspect the target of a layered `execute` call when enforcing turn semantics.

Underlying tools such as `new_task`, `attempt_completion`, and `request_condense_context` retain their current isolation or terminal behavior:

- An isolated target must be the only gateway call in its assistant turn.
- It cannot share a turn with `search`, `documentation`, or another `execute`.
- Sibling provider tool calls remain correctly paired through synthetic error results when suppressed.
- `attempt_completion` becomes terminal only according to its existing successful execution path.
- `request_condense_context` must preserve a complete outer tool-use/result pair before condensation.
- Streaming-aware rejection and suppression rules must account for already-executed earlier gateway calls.

Mode switches rebuild registry availability but never change the task protocol. A previously documented ID that is no longer allowed fails safely at execution.

## Provider and History Compatibility

Layered tasks send only the three stable gateway definitions to every provider. Providers that need complete definition lists for historical tool calls receive the three gateway definitions because a layered task's provider-visible history contains only those names.

Direct tasks retain their existing provider behavior and direct tool history. Since protocol is immutable per task, one conversation never requires both the full direct catalog and the layered catalog.

Legacy tasks without protocol metadata default to direct mode. This avoids interpreting existing direct tool calls through the gateway.

## Errors and Security

Gateway errors use structured, deterministic categories:

- Invalid gateway envelope.
- Unknown stable ID.
- Tool unavailable after registry refresh.
- Tool forbidden by the current mode or server allowlist.
- Invalid argument shape.
- Internal delegation failure.

Errors must not reveal disabled tool schemas, disallowed server catalogs, credentials, environment secrets, or arguments beyond existing logging policy.

Search and documentation never request user approval because they only inspect the already-allowed in-memory catalog. Execute does not add gateway-level approval; the underlying handler remains the sole approval authority.

The future sandboxed batch executor is explicitly separate. It requires an independent experiment and design covering sandbox isolation, call limits, approval granularity, cancellation, result aggregation, and network/filesystem restrictions.

## Observability

Add protocol visibility without replacing existing attribution:

- Task protocol dimension: direct or layered.
- Layered operation dimension: search, documentation, or execute.
- Underlying tool usage and failure continue to use the existing tool identity.
- Do not log execute arguments beyond current policy.

Logs and diagnostic errors should include stable IDs and source kinds when safe, making stale-ID and collision issues diagnosable.

## UI and Localization

The Experimental settings entry includes a localized name and description explaining:

- It reduces model context used by tool definitions.
- It exposes three model-facing discovery/execution tools.
- It applies only to newly created tasks.
- Existing and resumed tasks keep their original protocol.

The task header badge uses localized **Layered tools** and **Direct tools** labels with a concise tooltip. New markup follows existing Tailwind and VS Code variable conventions, and Settings inputs bind to local `cachedState` until the user saves.

## Testing Strategy

Use the narrowest layer that proves each behavior.

### Registry Unit Tests

- Native, MCP, and custom entry construction.
- Readable stable IDs.
- Escaping/normalization and deterministic collision suffixes.
- Stable ordering.
- Gateway self-exclusion.
- Mode, disabled-tool, experiment, model, and allowed-server filtering.
- Registry refresh and stale IDs.

### Gateway Unit Tests

- Search ranking and deterministic tie-breaking.
- Search default and maximum limits.
- Empty-query all-tool catalog without descriptions/schemas.
- Response ceilings and truncation markers.
- Documentation success, unknown IDs, suggestions, and output ceilings.
- Execute envelope validation and argument shape.
- Native, MCP, and custom adapter selection.
- Delegation errors without catalog leakage.

### Handler and Assistant Integration Tests

- Existing validation and approval callback reuse.
- Auto-approval behavior.
- UI status and result passthrough.
- Image and resource-link passthrough.
- Underlying telemetry attribution.
- Provider-visible outer tool-result pairing.
- Partial streaming behavior.
- Terminal and isolated-tool semantics, including sibling suppression.
- Mode changes between documentation and execution.

### Build and Provider Tests

- Direct mode returns the existing tool arrays unchanged.
- Layered mode returns exactly the three gateway definitions.
- Internally allowed registry contents match the direct filtered set.
- Gemini-style callable restrictions remain valid.
- Alias and include/exclude customization remains correct.

### Persistence and UI Tests

- Experiment defaults off.
- Experimental toggle uses Settings `cachedState` and save semantics.
- New-task protocol snapshot.
- Active tasks do not change when the global setting changes.
- Resume restores persisted protocol.
- Legacy history defaults to direct.
- Task-header badge reflects task metadata, not the global setting.
- Localization keys render correctly.

### Validation Commands

After implementation, run focused backend and webview Vitest suites from their respective package roots, backend and webview TypeScript checks, focused ESLint with no disabled rules, and `git diff --check`. Broader suites should be proportional to the final touched surface.

## Acceptance Criteria

1. With Layered Tooling disabled, model-visible definitions and tool behavior are unchanged.
2. With Layered Tooling enabled for a new task, the provider sees exactly `search`, `documentation`, and `execute` regardless of the number of allowed underlying tools.
3. Empty search lists all normally sized allowed catalogs using only IDs and names.
4. Documentation returns the complete available contract for one allowed tool.
5. Execute invokes one underlying tool with the same approval, UI, validation, result, and restriction behavior as direct mode.
6. Disabled or disallowed tools cannot be discovered or executed.
7. Isolated and terminal tools preserve their existing turn semantics through the execute envelope.
8. Task protocol is immutable, persisted, backward-compatible, and visible in the task header.
9. Focused automated tests and static validation pass.
