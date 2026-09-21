import type { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, type ToolCallbacks } from "./BaseTool"
import { layeredToolError, nearestLayeredToolIds } from "./layeredToolErrors"

const MAX_RESPONSE_BYTES = 128 * 1024

export class LayeredDocumentationTool extends BaseTool<"documentation"> {
	readonly name = "documentation" as const

	async execute(params: { tool_id: string }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		if (task.toolProtocol !== "layered") {
			callbacks.pushToolResult(
				layeredToolError(
					"tool_forbidden",
					"Documentation is available only in layered tasks.",
					undefined,
					"documentation",
				),
			)
			return
		}
		if (!params.tool_id?.trim()) {
			callbacks.pushToolResult(
				layeredToolError("invalid_gateway_envelope", "tool_id is required.", undefined, "documentation"),
			)
			return
		}

		const registry = await task.buildAllowedLayeredToolRegistry()
		const entry = registry.byId.get(params.tool_id)
		if (!entry) {
			callbacks.pushToolResult(
				layeredToolError(
					"unknown_tool_id",
					"The requested tool ID is unknown or no longer available.",
					nearestLayeredToolIds([...registry.byId.keys()], params.tool_id),
					"documentation",
				),
			)
			return
		}

		const response = {
			ok: true,
			operation: "documentation" as const,
			status: "completed" as const,
			tool: {
				id: entry.id,
				name: entry.displayName,
				aliases: entry.aliases,
				source: entry.source,
				...(entry.sourceName ? { source_name: entry.sourceName } : {}),
				description: entry.description,
				input_schema: entry.inputSchema,
				semantic: entry.semantic,
			},
			execute: {
				tool_id: entry.id,
				input: 'Provide a JSON object serialized as a string and matching input_schema. Use "{}" when input_schema has no required fields.',
			},
		}
		let serialized = JSON.stringify(response)
		if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) {
			serialized = JSON.stringify({
				...response,
				tool: { ...response.tool, description: entry.description.slice(0, 8_192), input_schema: undefined },
				truncated: true,
				message: "Documentation exceeded the response limit; description and schema were truncated.",
			})
		}
		callbacks.pushToolResult(serialized)
	}

	override async handlePartial(_task: Task, _block: ToolUse<"documentation">): Promise<void> {}
}

export const layeredDocumentationTool = new LayeredDocumentationTool()
