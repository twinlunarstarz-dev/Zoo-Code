# Request Condense Context Tool Design

## Objective

Expose context condensation as a built-in native tool so the language model can request an early condensation at a logical task boundary. Existing automatic condensation remains enabled and unchanged.

The tool is named `request_condense_context`. It runs without user approval and must be the only tool call in its assistant turn.

## Motivation

Automatic context management protects requests from exceeding the model context window, but its threshold may be reached in the middle of a task. Allowing the model to condense immediately after completing a coherent unit of work reduces the chance that the next automatic condensation occurs at a disruptive point.

This feature is an additional entry point into the existing manual condensation path, not a replacement for automatic context management.

## Architecture

### Native Tool Definition

Add `src/core/prompts/tools/native-tools/request_condense_context.ts` with an OpenAI-compatible function tool definition.

The tool:

- has no input parameters;
- uses a strict, empty object schema;
- explains that it is intended for logical boundaries where early condensation improves continuity;
- explicitly says it must be called alone in an assistant turn; and
- does not promise that automatic condensation is disabled afterward.

Register the definition in `getNativeTools()` in `src/core/prompts/tools/native-tools/index.ts`.

### Shared Tool Metadata

Register `request_condense_context` in:

- `toolNames` in `packages/types/src/tool.ts`;
- `NativeToolArgs` in `src/shared/tools.ts`, with an empty object argument type;
- `TOOL_DISPLAY_NAMES` in `src/shared/tools.ts`; and
- `ALWAYS_AVAILABLE_TOOLS` in `src/shared/tools.ts`.

Making the tool always available allows every mode to protect continuity without adding a new permission group or mode-specific configuration.

### Execution Handler

Add `RequestCondenseContextTool` in `src/core/tools/RequestCondenseContextTool.ts`, following the existing `BaseTool` pattern.

On execution, the handler will:

1. reset the consecutive mistake count;
2. push one success tool result indicating that condensation is starting;
3. call `Task.condenseContext()`; and
4. route thrown failures through the standard `handleError` callback.

The success result must be pushed before `Task.condenseContext()` is called. The existing condensation method begins by flushing pending tool results. This ordering ensures the current `tool_use` has a matching `tool_result` in conversation history before the history is summarized.

The handler does not request approval. Condensation changes conversation representation but does not perform an external side effect such as editing files or running commands.

Wire the handler into the native tool dispatch switch in `src/core/assistant-message/presentAssistantMessage.ts`.

### Isolated-Turn Semantics

`request_condense_context` must be called alone because condensation replaces the effective API history while tool processing is underway. Sibling tools must not execute against history that is being condensed.

Enforce this rule in the completed assistant-turn validation in `Task.recursivelyMakeClineRequests()`, near the existing special handling for `new_task`:

- when a completed assistant turn contains `request_condense_context` and other tool calls, retain the condensation call for execution;
- synthesize an error result for every sibling tool call; and
- state in each error that it was skipped because `request_condense_context` must be the only tool in the turn.

This behavior prioritizes the explicitly requested context-boundary operation and prevents partial sibling execution. The tool description should make this recovery path uncommon.

## Data Flow

1. Tool assembly exposes `request_condense_context` to the provider in every mode.
2. The model returns a native tool call with an empty argument object.
3. Assistant-turn validation confirms the call is isolated, or creates sibling error results.
4. `presentAssistantMessage()` dispatches to `RequestCondenseContextTool`.
5. The handler pushes the matching success tool result.
6. `Task.condenseContext()` flushes pending results, invokes `summarizeConversation()` with `isAutomaticTrigger: false`, overwrites stored API history with the non-destructive condensed representation, and emits the existing condensation UI message.
7. The task loop continues with the condensed effective history and newly generated environment details.

## Error Handling

- Invalid or missing native arguments continue to use the existing native tool validation path.
- A thrown condensation failure is converted into the standard tool error result through `handleError`.
- Errors already handled internally by `Task.condenseContext()` continue to emit the existing `condense_context_error` UI message. The existing method currently returns after such an error; this design does not change that contract.
- Sibling calls in a non-isolated turn receive synthetic error results so every native `tool_use` has exactly one matching `tool_result`.
- Automatic condensation behavior and thresholds are untouched.

## Testing

Add focused backend tests at the narrowest useful layers.

### Handler Tests

Cover `RequestCondenseContextTool` directly:

- it does not request user approval;
- it emits the success result before invoking `Task.condenseContext()`;
- it invokes `Task.condenseContext()` exactly once;
- it resets the consecutive mistake count; and
- it sends thrown errors to `handleError` without emitting a duplicate result.

### Registration and Filtering Tests

Verify:

- `getNativeTools()` includes the zero-argument strict schema;
- the name is accepted by the shared tool schema and validation; and
- mode filtering retains it for modes that do not otherwise grant tool groups.

### Isolated-Turn Regression Tests

Verify:

- an isolated condensation call executes normally;
- when called with siblings, the condensation call remains executable;
- sibling calls are not executed; and
- every skipped sibling receives a matching synthetic error result.

### Validation Commands

Run focused Vitest files from the `src` workspace, followed by the backend TypeScript check and focused linting for changed files. Expand validation if focused tests reveal a cross-module regression.

## Non-Goals

- Disabling or changing automatic condensation.
- Adding a user-facing setting for this tool.
- Adding tool parameters such as a reason, target token count, or custom summary instructions.
- Introducing a second condensation implementation.
- Refactoring the broader context-management state machine.

## Acceptance Criteria

- The model can see and call `request_condense_context` in every mode.
- The call requires no user approval.
- The call uses the existing manual condensation implementation.
- The current tool-use/result pair is complete before summarization begins.
- The tool is safely isolated from sibling tool execution.
- Automatic condensation continues to operate as before.
- Focused tests, backend type checking, and focused linting pass.
