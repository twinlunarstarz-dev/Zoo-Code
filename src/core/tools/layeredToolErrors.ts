export type LayeredToolErrorCode =
	| "invalid_gateway_envelope"
	| "unknown_tool_id"
	| "tool_unavailable"
	| "tool_forbidden"
	| "invalid_arguments"
	| "delegation_failure"

export type LayeredToolOperation = "search" | "documentation" | "execute"

export interface LayeredToolExecutionResult {
	ok: boolean
	operation: LayeredToolOperation
	tool_id?: string
	tool_name?: string
	source?: "native" | "mcp" | "custom"
	status: "completed" | "rejected" | "failed" | "cancelled"
	error?: { code: LayeredToolErrorCode; message: string; suggestions?: string[] }
}

export function layeredToolError(
	code: LayeredToolErrorCode,
	message: string,
	suggestions?: string[],
	operation: LayeredToolOperation = "execute",
): string {
	return JSON.stringify({
		ok: false,
		operation,
		status: "failed" satisfies LayeredToolExecutionResult["status"],
		error: { code, message, ...(suggestions?.length ? { suggestions } : {}) },
	})
}

export function layeredToolCancelled(toolId?: string): string {
	return JSON.stringify({
		ok: false,
		operation: "execute",
		status: "cancelled",
		...(toolId ? { tool_id: toolId } : {}),
	})
}

export function nearestLayeredToolIds(ids: string[], requestedId: string, limit = 3): string[] {
	const query = requestedId.toLowerCase()
	return ids
		.map((id) => ({ id, score: id.toLowerCase().includes(query) || query.includes(id.toLowerCase()) ? 1 : 0 }))
		.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id, "en"))
		.slice(0, limit)
		.map(({ id }) => id)
}
