import type { ToolName } from "@roo-code/types"

import type { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"
import { normalizeNativeToolUse } from "../assistant-message/NativeToolCallParser"

import { BaseTool, type ToolCallbacks } from "./BaseTool"
import { dispatchToolUse, type DispatchToolUseOptions } from "./dispatchToolUse"
import { layeredToolCancelled, layeredToolError, nearestLayeredToolIds } from "./layeredToolErrors"

export interface LayeredExecuteCallbacks extends ToolCallbacks {
	onExecutionStart?: (toolId: string, toolName: string) => void
	onExecutionComplete?: (toolId: string, toolName: string) => void
	onExecutionError?: (toolId: string, toolName: string, error: unknown) => void
	dispatchOptions: Omit<
		DispatchToolUseOptions,
		"askApproval" | "handleError" | "pushToolResult" | "pushUnknownToolResult"
	>
}

export class LayeredExecuteTool extends BaseTool<"execute"> {
	readonly name = "execute" as const

	async execute(
		params: { tool_id: string; input: string | Record<string, unknown> },
		task: Task,
		callbacks: LayeredExecuteCallbacks,
	): Promise<void> {
		const fail = (code: Parameters<typeof layeredToolError>[0], message: string) => {
			task.consecutiveMistakeCount++
			task.recordToolError("execute")
			task.didToolFailInCurrentTurn = true
			callbacks.pushToolResult(layeredToolError(code, message))
		}
		if (task.abort || task.currentRequestAbortController?.signal.aborted) {
			callbacks.pushToolResult(layeredToolCancelled(params.tool_id))
			return
		}

		if (task.toolProtocol !== "layered") {
			fail("tool_forbidden", "Execute is available only in layered tasks.")
			return
		}
		if (!params.tool_id?.trim()) {
			fail("invalid_gateway_envelope", "tool_id is required.")
			return
		}

		let targetArguments: Record<string, unknown> = {}
		if (typeof params.input === "string") {
			try {
				const parsed = JSON.parse(params.input)
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
					fail("invalid_arguments", "input must encode a JSON object.")
					return
				}
				targetArguments = parsed as Record<string, unknown>
			} catch {
				fail("invalid_arguments", "input must be valid JSON serialized as a string.")
				return
			}
		} else if (typeof params.input === "object" && params.input !== null && !Array.isArray(params.input)) {
			// Compatibility for providers that ignore the string schema and emit the documented target object directly.
			targetArguments = params.input as Record<string, unknown>
		} else {
			fail("invalid_arguments", "input must be a JSON object serialized as a string.")
			return
		}
		// Providers may emit either `{ arguments: {...} }` or `{ input: {...} }` inside
		// the gateway input. Only unwrap the former when it is an object so a target
		// that legitimately has an `arguments` property is not changed.
		if (Object.keys(targetArguments).length === 1 && "arguments" in targetArguments) {
			const legacyArguments = targetArguments.arguments
			if (typeof legacyArguments === "object" && legacyArguments !== null && !Array.isArray(legacyArguments)) {
				targetArguments = legacyArguments as Record<string, unknown>
			} else if (typeof legacyArguments === "string") {
				try {
					const parsed = JSON.parse(legacyArguments)
					if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
						fail("invalid_arguments", "Legacy arguments must encode a JSON object.")
						return
					}
					targetArguments = parsed as Record<string, unknown>
				} catch {
					fail("invalid_arguments", "Legacy arguments must be a valid JSON object serialized as a string.")
					return
				}
			}
		}

		const registry = await task.buildAllowedLayeredToolRegistry()
		const entry = registry.byId.get(params.tool_id)
		if (!entry) {
			task.consecutiveMistakeCount++
			task.recordToolError("execute")
			task.didToolFailInCurrentTurn = true
			callbacks.pushToolResult(
				layeredToolError(
					"unknown_tool_id",
					"The requested tool ID is unknown or no longer available.",
					nearestLayeredToolIds([...registry.byId.keys()], params.tool_id),
				),
			)
			return
		}
		if (task.abort || task.currentRequestAbortController?.signal.aborted) {
			callbacks.pushToolResult(layeredToolCancelled(entry.id))
			return
		}

		const id = callbacks.toolCallId ?? params.tool_id
		let underlyingBlock: ToolUse
		if (entry.adapter.kind === "mcp") {
			// The MCP adapter expects the target arguments directly under `arguments`.
			// Do not pass the gateway envelope or stringify the values here.
			underlyingBlock = {
				type: "tool_use",
				id,
				name: "use_mcp_tool",
				params: {},
				nativeArgs: {
					server_name: entry.adapter.serverName,
					tool_name: entry.adapter.toolName,
					arguments: targetArguments,
				},
				partial: false,
			}
		} else if (entry.adapter.kind === "custom") {
			underlyingBlock = {
				type: "tool_use",
				id,
				name: entry.adapter.toolName as ToolName,
				params: {},
				nativeArgs: targetArguments as never,
				partial: false,
			}
		} else {
			// Native tools must be normalized against their actual tool schema before
			// dispatch; forwarding the raw gateway input loses parser coercion.
			const normalizedBlock = normalizeNativeToolUse(id, entry.adapter.toolName as ToolName, targetArguments)
			if (!normalizedBlock) {
				fail("invalid_arguments", "Arguments do not satisfy the requested tool schema.")
				return
			}
			underlyingBlock = normalizedBlock
		}

		callbacks.onExecutionStart?.(entry.id, entry.canonicalName)
		try {
			await dispatchToolUse(task, underlyingBlock, {
				...callbacks.dispatchOptions,
				askApproval: callbacks.askApproval,
				handleError: callbacks.handleError,
				pushToolResult: callbacks.pushToolResult,
				pushUnknownToolResult: callbacks.pushToolResult,
			})
			callbacks.onExecutionComplete?.(entry.id, entry.canonicalName)
		} catch (error) {
			callbacks.onExecutionError?.(entry.id, entry.canonicalName, error)
			throw error
		}
	}

	async handleWithDispatch(task: Task, block: ToolUse<"execute">, callbacks: LayeredExecuteCallbacks): Promise<void> {
		if (block.partial) return
		if (!block.nativeArgs) {
			callbacks.pushToolResult(layeredToolError("invalid_gateway_envelope", "Execute arguments are missing."))
			return
		}
		await this.execute(block.nativeArgs, task, callbacks)
	}
}

export const layeredExecuteTool = new LayeredExecuteTool()
