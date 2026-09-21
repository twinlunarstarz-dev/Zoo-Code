import { Task } from "../task/Task"
import { searchChatHistory } from "../task-persistence/chatHistorySearch"
import { BaseTool, type ToolCallbacks } from "./BaseTool"

export class ChatHistoryLookupTool extends BaseTool<"chat_history_lookup"> {
	readonly name = "chat_history_lookup" as const

	async execute(params: { query: string; limit?: number }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const globalStoragePath = task.providerRef.deref()?.contextProxy.globalStorageUri.fsPath
		if (!globalStoragePath) {
			callbacks.pushToolResult(
				JSON.stringify({ ok: false, error: "Global conversation storage is unavailable." }),
			)
			return
		}
		const results = await searchChatHistory(globalStoragePath, params.query, params.limit)
		callbacks.pushToolResult(JSON.stringify({ ok: true, query: params.query, results }))
	}
}

export const chatHistoryLookupTool = new ChatHistoryLookupTool()
