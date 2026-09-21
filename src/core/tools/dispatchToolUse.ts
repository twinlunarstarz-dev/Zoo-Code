import type { ToolName } from "@roo-code/types"
import { customToolRegistry } from "@roo-code/core"

import { t } from "../../i18n"
import { defaultModeSlug } from "../../shared/modes"
import type { ToolResponse, ToolUse } from "../../shared/tools"
import type { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"

import type { ToolCallbacks } from "./BaseTool"
import { accessMcpResourceTool } from "./accessMcpResourceTool"
import { applyDiffTool } from "./ApplyDiffTool"
import { applyPatchTool } from "./ApplyPatchTool"
import { askFollowupQuestionTool } from "./AskFollowupQuestionTool"
import { attemptCompletionTool, type AttemptCompletionCallbacks } from "./AttemptCompletionTool"
import { codebaseSearchTool } from "./CodebaseSearchTool"
import { editFileTool } from "./EditFileTool"
import { editTool } from "./EditTool"
import { executeCommandTool } from "./ExecuteCommandTool"
import { generateImageTool } from "./GenerateImageTool"
import { listFilesTool } from "./ListFilesTool"
import { newTaskTool } from "./NewTaskTool"
import { readCommandOutputTool } from "./ReadCommandOutputTool"
import { readFileTool } from "./ReadFileTool"
import { requestCondenseContextTool } from "./RequestCondenseContextTool"
import { runSlashCommandTool } from "./RunSlashCommandTool"
import { searchFilesTool } from "./SearchFilesTool"
import { searchReplaceTool } from "./SearchReplaceTool"
import { skillTool } from "./SkillTool"
import { switchModeTool } from "./SwitchModeTool"
import { updateTodoListTool } from "./UpdateTodoListTool"
import { useMcpToolTool } from "./UseMcpToolTool"
import { writeToFileTool } from "./WriteToFileTool"
import { chatHistoryLookupTool } from "./ChatHistoryLookupTool"

export interface DispatchToolUseOptions extends ToolCallbacks {
	mode?: string
	customToolsEnabled?: boolean
	askFinishSubTaskApproval: AttemptCompletionCallbacks["askFinishSubTaskApproval"]
	toolDescription: AttemptCompletionCallbacks["toolDescription"]
	pushUnknownToolResult: (content: ToolResponse) => void
}

async function checkpointSaveAndMark(task: Task): Promise<void> {
	if (task.currentStreamingDidCheckpoint) return
	try {
		await task.checkpointSave(true)
		task.currentStreamingDidCheckpoint = true
	} catch (error) {
		console.error(`[Task#dispatchToolUse] Error saving checkpoint: ${error.message}`, error)
	}
}

/**
 * Dispatches an already-presented and validated tool call to its existing handler.
 * The block ID is preserved, allowing a layered gateway to reuse the outer provider call ID.
 */
export async function dispatchToolUse(task: Task, block: ToolUse, options: DispatchToolUseOptions): Promise<void> {
	const callbacks: ToolCallbacks = {
		askApproval: options.askApproval,
		handleError: options.handleError,
		pushToolResult: options.pushToolResult,
	}

	switch (block.name) {
		case "write_to_file":
			await checkpointSaveAndMark(task)
			await writeToFileTool.handle(task, block as ToolUse<"write_to_file">, callbacks)
			return
		case "update_todo_list":
			await updateTodoListTool.handle(task, block as ToolUse<"update_todo_list">, callbacks)
			return
		case "apply_diff":
			await checkpointSaveAndMark(task)
			await applyDiffTool.handle(task, block as ToolUse<"apply_diff">, callbacks)
			return
		case "edit":
		case "search_and_replace":
			await checkpointSaveAndMark(task)
			await editTool.handle(task, block as ToolUse<"edit">, callbacks)
			return
		case "search_replace":
			await checkpointSaveAndMark(task)
			await searchReplaceTool.handle(task, block as ToolUse<"search_replace">, callbacks)
			return
		case "edit_file":
			await checkpointSaveAndMark(task)
			await editFileTool.handle(task, block as ToolUse<"edit_file">, callbacks)
			return
		case "apply_patch":
			await checkpointSaveAndMark(task)
			await applyPatchTool.handle(task, block as ToolUse<"apply_patch">, callbacks)
			return
		case "read_file":
			await readFileTool.handle(task, block as ToolUse<"read_file">, callbacks)
			return
		case "list_files":
			await listFilesTool.handle(task, block as ToolUse<"list_files">, callbacks)
			return
		case "codebase_search":
			await codebaseSearchTool.handle(task, block as ToolUse<"codebase_search">, callbacks)
			return
		case "search_files":
			await searchFilesTool.handle(task, block as ToolUse<"search_files">, callbacks)
			return
		case "execute_command":
			await executeCommandTool.handle(task, block as ToolUse<"execute_command">, callbacks)
			return
		case "read_command_output":
			await readCommandOutputTool.handle(task, block as ToolUse<"read_command_output">, callbacks)
			return
		case "use_mcp_tool":
			await useMcpToolTool.handle(task, block as ToolUse<"use_mcp_tool">, callbacks)
			return
		case "access_mcp_resource":
			await accessMcpResourceTool.handle(task, block as ToolUse<"access_mcp_resource">, callbacks)
			return
		case "ask_followup_question":
			await askFollowupQuestionTool.handle(task, block as ToolUse<"ask_followup_question">, callbacks)
			return
		case "switch_mode":
			await switchModeTool.handle(task, block as ToolUse<"switch_mode">, callbacks)
			return
		case "new_task":
			await checkpointSaveAndMark(task)
			await newTaskTool.handle(task, block as ToolUse<"new_task">, { ...callbacks, toolCallId: block.id })
			return
		case "attempt_completion": {
			const completionCallbacks: AttemptCompletionCallbacks = {
				...callbacks,
				askFinishSubTaskApproval: options.askFinishSubTaskApproval,
				toolDescription: options.toolDescription,
			}
			await attemptCompletionTool.handle(task, block as ToolUse<"attempt_completion">, completionCallbacks)
			return
		}
		case "run_slash_command":
			await runSlashCommandTool.handle(task, block as ToolUse<"run_slash_command">, callbacks)
			return
		case "skill":
			await skillTool.handle(task, block as ToolUse<"skill">, callbacks)
			return
		case "request_condense_context":
			await requestCondenseContextTool.handle(task, block as ToolUse<"request_condense_context">, callbacks)
			return
		case "chat_history_lookup":
			await chatHistoryLookupTool.handle(task, block as ToolUse<"chat_history_lookup">, callbacks)
			return
		case "generate_image":
			await checkpointSaveAndMark(task)
			await generateImageTool.handle(task, block as ToolUse<"generate_image">, callbacks)
			return
	}

	if (block.partial) return

	const customTool = options.customToolsEnabled ? customToolRegistry.get(block.name) : undefined
	if (customTool) {
		try {
			let customToolArgs
			if (customTool.parameters) {
				try {
					customToolArgs = customTool.parameters.parse(block.nativeArgs || block.params || {})
				} catch (parseParamsError) {
					const message = `Custom tool "${block.name}" argument validation failed: ${parseParamsError.message}`
					console.error(message)
					task.consecutiveMistakeCount++
					await task.say("error", message)
					options.pushToolResult(formatResponse.toolError(message))
					return
				}
			}

			const result = await customTool.execute(customToolArgs, {
				mode: options.mode ?? defaultModeSlug,
				task,
			})
			console.log(`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(result)}`)
			options.pushToolResult(result)
			task.consecutiveMistakeCount = 0
		} catch (executionError: any) {
			task.consecutiveMistakeCount++
			task.recordToolError("custom_tool", executionError.message)
			await options.handleError(`executing custom tool "${block.name}"`, executionError)
		}
		return
	}

	const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
	task.consecutiveMistakeCount++
	task.recordToolError(block.name as ToolName, errorMessage)
	await task.say("error", t("tools:unknownToolError", { toolName: block.name }))
	options.pushUnknownToolResult(formatResponse.toolError(errorMessage))
}
