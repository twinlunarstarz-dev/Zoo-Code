import type { Task } from "../task/Task"
import { searchLayeredToolRegistry } from "../task/layered-tools"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, type ToolCallbacks } from "./BaseTool"
import { layeredToolError } from "./layeredToolErrors"

const MAX_RESPONSE_BYTES = 64 * 1024

export class LayeredSearchTool extends BaseTool<"search"> {
	readonly name = "search" as const

	async execute(params: { query?: string; limit?: number }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		if (task.toolProtocol !== "layered") {
			callbacks.pushToolResult(
				layeredToolError("tool_forbidden", "Search is available only in layered tasks.", undefined, "search"),
			)
			return
		}

		const query = typeof params.query === "string" ? params.query.trim() : ""
		const limit = query ? Math.max(1, Math.min(50, Math.floor(params.limit ?? 10))) : undefined
		const registry = await task.buildAllowedLayeredToolRegistry()
		const results = searchLayeredToolRegistry(registry, query, {
			limit,
			includeAliases: true,
			includeDetails: false,
		})
		const response = {
			ok: true,
			operation: "search" as const,
			status: "completed" as const,
			query,
			results: results.map(({ score: _score, semantic: _semantic, ...result }) => result),
		}
		let serialized = JSON.stringify(response)
		if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) {
			const truncatedResults = response.results.slice(0, Math.max(1, Math.floor(response.results.length / 2)))
			serialized = JSON.stringify({
				...response,
				results: truncatedResults,
				truncated: true,
				message: "Result exceeded the response limit. Provide a non-empty query to narrow the catalog.",
			})
		}
		callbacks.pushToolResult(serialized)
	}

	override async handlePartial(_task: Task, _block: ToolUse<"search">): Promise<void> {}
}

export const layeredSearchTool = new LayeredSearchTool()
