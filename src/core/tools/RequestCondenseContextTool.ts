import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

export class RequestCondenseContextTool extends BaseTool<"request_condense_context"> {
	readonly name = "request_condense_context" as const

	async execute(_params: Record<string, never>, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks

		try {
			task.consecutiveMistakeCount = 0

			// condenseContext starts by flushing pending tool results. Emit this result
			// first so the current tool_use/tool_result pair is complete before summarizing.
			pushToolResult("Context condensation requested. Condensing the conversation context now.")
			await task.condenseContext()
		} catch (error) {
			// A success result was already emitted before condensation started so that
			// flushPendingToolResultsToHistory can persist a complete tool pair. Report
			// late failures in the chat without attempting a duplicate tool_result.
			await task.say("error", `Error condensing context: ${(error as Error).message}`)
		}
	}
}

export const requestCondenseContextTool = new RequestCondenseContextTool()
