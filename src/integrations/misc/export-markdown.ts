import type { Anthropic } from "@anthropic-ai/sdk"
import os from "os"
import * as path from "path"
import * as vscode from "vscode"

// Extended content block types to support new Anthropic API features
interface ReasoningBlock {
	type: "reasoning"
	text: string
}

interface ThoughtSignatureBlock {
	type: "thoughtSignature"
}

export type ExtendedContentBlock =
	| Anthropic.Messages.ContentBlockParam
	| Anthropic.Messages.ToolReferenceBlockParam
	| ReasoningBlock
	| ThoughtSignatureBlock

type TaskExportFormat = "Markdown" | "ChatML"

export function getTaskFileName(dateTs: number, extension = "md"): string {
	const date = new Date(dateTs)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12 // the hour '0' should be '12'
	return `roo_task_${month}-${day}-${year}_${hours}-${minutes}-${seconds}-${ampm}.${extension}`
}

export async function downloadTask(
	dateTs: number,
	conversationHistory: Anthropic.MessageParam[],
	defaultUri: vscode.Uri,
): Promise<vscode.Uri | undefined> {
	const format = (await vscode.window.showQuickPick(["Markdown", "ChatML"])) as TaskExportFormat | undefined
	if (!format) {
		return undefined
	}

	const isChatML = format === "ChatML"
	const extension = isChatML ? "jsonl" : "md"
	const content = isChatML
		? formatConversationToChatML(conversationHistory)
		: formatConversationToMarkdown(conversationHistory)
	const defaultFileUri = vscode.Uri.file(
		path.join(path.dirname(defaultUri.fsPath), getTaskFileName(dateTs, extension)),
	)

	// Prompt user for save location
	const saveUri = await vscode.window.showSaveDialog({
		filters: { [format]: [extension] },
		defaultUri: defaultFileUri,
	})

	if (saveUri) {
		// Write content to the selected location
		await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content))
		vscode.window.showTextDocument(saveUri, { preview: true })
		return saveUri
	}
	return undefined
}

export function formatConversationToMarkdown(conversationHistory: Anthropic.MessageParam[]): string {
	return conversationHistory
		.map((message) => {
			const role = message.role === "user" ? "**User:**" : "**Assistant:**"
			return `${role}\n\n${formatMessageContent(message.content)}\n\n`
		})
		.join("---\n\n")
}

export function formatConversationToChatML(conversationHistory: Anthropic.MessageParam[]): string {
	const messages = conversationHistory
		.map((message) => ({
			role: message.role,
			content: formatMessageContent(message.content),
		}))
		.filter((message) => message.content.trim().length > 0)

	return `${JSON.stringify({ messages })}\n`
}

function formatMessageContent(content: Anthropic.MessageParam["content"]): string {
	return Array.isArray(content)
		? content
				.map((block) => formatContentBlockToMarkdown(block as ExtendedContentBlock))
				.filter(Boolean)
				.join("\n")
		: content
}

export function formatContentBlockToMarkdown(block: ExtendedContentBlock): string {
	switch (block.type) {
		case "text":
			return block.text
		case "image":
			return `[Image]`
		case "document":
			return `[Document]`
		case "search_result":
			return `[Search Result]`
		case "tool_reference":
			return `[Tool Reference]`
		case "tool_use": {
			let input: string
			if (typeof block.input === "object" && block.input !== null) {
				input = Object.entries(block.input)
					.map(([key, value]) => {
						const formattedKey = key.charAt(0).toUpperCase() + key.slice(1)
						// Handle nested objects/arrays by JSON stringifying them
						const formattedValue =
							typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
						return `${formattedKey}: ${formattedValue}`
					})
					.join("\n")
			} else {
				input = String(block.input)
			}
			return `[Tool Use: ${block.name}]\n${input}`
		}
		case "tool_result": {
			// For now we're not doing tool name lookup since we don't use tools anymore
			// const toolName = findToolName(block.tool_use_id, messages)
			const toolName = "Tool"
			if (typeof block.content === "string") {
				return `[${toolName}${block.is_error ? " (Error)" : ""}]\n${block.content}`
			} else if (Array.isArray(block.content)) {
				return `[${toolName}${block.is_error ? " (Error)" : ""}]\n${block.content
					.map((contentBlock) => formatContentBlockToMarkdown(contentBlock))
					.join("\n")}`
			} else {
				return `[${toolName}${block.is_error ? " (Error)" : ""}]`
			}
		}
		case "reasoning":
			return `[Reasoning]\n${block.text}`
		case "thoughtSignature":
			// Not relevant for human-readable exports
			return ""
		default:
			return `[Unexpected content type: ${block.type}]`
	}
}

export function findToolName(toolCallId: string, messages: Anthropic.MessageParam[]): string {
	for (const message of messages) {
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use" && block.id === toolCallId) {
					return block.name
				}
			}
		}
	}
	return "Unknown Tool"
}
