import type { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ExtendedContentBlock } from "../export-markdown"
import { downloadTask, formatContentBlockToMarkdown, formatConversationToChatML } from "../export-markdown"

describe("export-markdown", () => {
	const showQuickPick = vi.fn()
	const showSaveDialog = vi.fn()
	const showTextDocument = vi.fn()
	const writeFile = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		Object.assign(vscode.window, { showQuickPick, showSaveDialog, showTextDocument })
		Object.assign(vscode.workspace.fs, { writeFile })
	})

	describe("downloadTask", () => {
		const dateTs = new Date(2026, 6, 16, 12, 30, 45).getTime()
		const conversation: Anthropic.MessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]
		const defaultUri = vscode.Uri.file("C:\\Downloads\\roo_task.md")

		it("exports ChatML as JSONL", async () => {
			const saveUri = vscode.Uri.file("C:\\Downloads\\roo_task.jsonl")
			showQuickPick.mockResolvedValue("ChatML")
			showSaveDialog.mockResolvedValue(saveUri)

			await expect(downloadTask(dateTs, conversation, defaultUri)).resolves.toBe(saveUri)

			expect(showSaveDialog).toHaveBeenCalledWith({
				filters: { ChatML: ["jsonl"] },
				defaultUri: expect.objectContaining({ fsPath: expect.stringMatching(/\.jsonl$/) }),
			})
			expect(writeFile).toHaveBeenCalledWith(
				saveUri,
				Buffer.from(
					`${JSON.stringify({
						messages: [
							{ role: "user", content: "Hello" },
							{ role: "assistant", content: "Hi" },
						],
					})}\n`,
				),
			)
			expect(showTextDocument).toHaveBeenCalledWith(saveUri, { preview: true })
		})

		it("preserves the existing Markdown export", async () => {
			const saveUri = vscode.Uri.file("C:\\Downloads\\roo_task.md")
			showQuickPick.mockResolvedValue("Markdown")
			showSaveDialog.mockResolvedValue(saveUri)

			await downloadTask(dateTs, conversation, defaultUri)

			expect(showSaveDialog).toHaveBeenCalledWith({
				filters: { Markdown: ["md"] },
				defaultUri: expect.objectContaining({ fsPath: expect.stringMatching(/\.md$/) }),
			})
			expect(writeFile).toHaveBeenCalledWith(
				saveUri,
				Buffer.from("**User:**\n\nHello\n\n---\n\n**Assistant:**\n\nHi\n\n"),
			)
		})

		it("stops when the format picker is cancelled", async () => {
			showQuickPick.mockResolvedValue(undefined)

			await expect(downloadTask(dateTs, conversation, defaultUri)).resolves.toBeUndefined()

			expect(showSaveDialog).not.toHaveBeenCalled()
			expect(writeFile).not.toHaveBeenCalled()
		})

		it("does not write when the save dialog is cancelled", async () => {
			showQuickPick.mockResolvedValue("ChatML")
			showSaveDialog.mockResolvedValue(undefined)

			await expect(downloadTask(dateTs, conversation, defaultUri)).resolves.toBeUndefined()

			expect(writeFile).not.toHaveBeenCalled()
			expect(showTextDocument).not.toHaveBeenCalled()
		})
	})

	describe("formatConversationToChatML", () => {
		it("formats a conversation as ChatML JSONL", () => {
			const conversation: Anthropic.MessageParam[] = [
				{ role: "user", content: "Create a TypeScript function." },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Here is the function:" },
						{ type: "tool_use", id: "tool-1", name: "write_to_file", input: { path: "index.ts" } },
					],
				},
			]

			const result = formatConversationToChatML(conversation)

			expect(result.endsWith("\n")).toBe(true)
			expect(JSON.parse(result)).toEqual({
				messages: [
					{ role: "user", content: "Create a TypeScript function." },
					{
						role: "assistant",
						content: "Here is the function:\n[Tool Use: write_to_file]\nPath: index.ts",
					},
				],
			})
		})

		it("omits messages without trainable text content", () => {
			const conversation = [
				{ role: "assistant", content: [{ type: "thoughtSignature" } as ExtendedContentBlock] },
				{ role: "user", content: "Continue." },
			] as unknown as Anthropic.MessageParam[]

			expect(JSON.parse(formatConversationToChatML(conversation))).toEqual({
				messages: [{ role: "user", content: "Continue." }],
			})
		})
	})

	describe("formatContentBlockToMarkdown", () => {
		it("should format text blocks", () => {
			const block = { type: "text", text: "Hello, world!" } as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("Hello, world!")
		})

		it("should format image blocks", () => {
			const block = {
				type: "image",
				source: { type: "base64", media_type: "image/png", data: "data" },
			} as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Image]")
		})

		it("should format tool_use blocks with string input", () => {
			const block = { type: "tool_use", name: "read_file", id: "123", input: "file.txt" } as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool Use: read_file]\nfile.txt")
		})

		it("should format tool_use blocks with object input", () => {
			const block = {
				type: "tool_use",
				name: "read_file",
				id: "123",
				input: { path: "file.txt", line_count: 10 },
			} as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool Use: read_file]\nPath: file.txt\nLine_count: 10")
		})

		it("should format tool_result blocks with string content", () => {
			const block = { type: "tool_result", tool_use_id: "123", content: "File content" } as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool]\nFile content")
		})

		it("should format tool_result blocks with error", () => {
			const block = {
				type: "tool_result",
				tool_use_id: "123",
				content: "Error message",
				is_error: true,
			} as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool (Error)]\nError message")
		})

		it("should format tool_result blocks with array content", () => {
			const block = {
				type: "tool_result",
				tool_use_id: "123",
				content: [
					{ type: "text", text: "Line 1" },
					{ type: "text", text: "Line 2" },
				],
			} as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool]\nLine 1\nLine 2")
		})

		it("should format reasoning blocks", () => {
			const block = { type: "reasoning", text: "Let me think about this..." } as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Reasoning]\nLet me think about this...")
		})

		it("should skip thoughtSignature blocks", () => {
			const block = { type: "thoughtSignature" } as ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("")
		})

		it("should handle unexpected content types", () => {
			const block = { type: "unknown_type" as const } as any
			expect(formatContentBlockToMarkdown(block)).toBe("[Unexpected content type: unknown_type]")
		})

		it("should format document blocks", () => {
			const block = {
				type: "document",
				source: { type: "base64", media_type: "application/pdf", data: "abc" } as const,
			} satisfies ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Document]")
		})

		it("should format search_result blocks", () => {
			const block = {
				type: "search_result",
				source: "https://example.com",
				title: "Example",
				content: [{ type: "text", text: "result text" }],
			} satisfies ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Search Result]")
		})

		it("should format tool_reference blocks", () => {
			const block = {
				type: "tool_reference",
				tool_name: "read_file",
			} satisfies ExtendedContentBlock
			expect(formatContentBlockToMarkdown(block)).toBe("[Tool Reference]")
		})
	})
})
