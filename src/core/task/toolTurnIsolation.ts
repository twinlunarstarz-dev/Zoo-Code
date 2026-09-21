import type { Anthropic } from "@anthropic-ai/sdk"

import type { LayeredToolRegistry } from "./layered-tools"

type AssistantContentBlock = Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam

export function resolveEffectiveToolName(
	block: AssistantContentBlock,
	registry?: LayeredToolRegistry,
): string | undefined {
	if (block.type !== "tool_use") return undefined
	if (block.name !== "execute") return block.name

	const input = block.input
	if (!input || typeof input !== "object" || Array.isArray(input)) return block.name
	const toolId = (input as Record<string, unknown>).tool_id
	if (typeof toolId !== "string") return block.name
	return registry?.byId.get(toolId)?.canonicalName ?? block.name
}

export type ToolTurnIsolationResult = {
	executionContent: AssistantContentBlock[]
	injectedToolResults: Anthropic.ToolResultBlockParam[]
}

/**
 * Enforces the completed-turn half of request_condense_context isolation.
 *
 * If condensation is the first tool call, later tools remain in API history but
 * are removed from execution and receive synthetic error results. A condensation
 * call after an earlier tool is rejected during streamed presentation instead.
 */
export function enforceCondenseToolTurnIsolation(
	assistantContent: AssistantContentBlock[],
	registry?: LayeredToolRegistry,
): ToolTurnIsolationResult {
	const condenseIndex = assistantContent.findIndex(
		(block) => resolveEffectiveToolName(block, registry) === "request_condense_context",
	)
	const firstToolIndex = assistantContent.findIndex((block) => block.type === "tool_use")

	if (condenseIndex === -1 || condenseIndex !== firstToolIndex || condenseIndex === assistantContent.length - 1) {
		return { executionContent: assistantContent, injectedToolResults: [] }
	}

	const laterBlocks = assistantContent.slice(condenseIndex + 1)
	const injectedToolResults = laterBlocks.flatMap((block): Anthropic.ToolResultBlockParam[] => {
		if (block.type !== "tool_use" || !block.id) {
			return []
		}

		return [
			{
				type: "tool_result",
				tool_use_id: block.id,
				content:
					"This tool was not executed because request_condense_context was called in the same assistant turn. request_condense_context must be the only tool call in its turn.",
				is_error: true,
			},
		]
	})

	return {
		executionContent: assistantContent.slice(0, condenseIndex + 1),
		injectedToolResults,
	}
}
