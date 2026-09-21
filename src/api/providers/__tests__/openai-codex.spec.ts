// npx vitest run api/providers/__tests__/openai-codex.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { OpenAiCodexHandler } from "../openai-codex"
import { openAiCodexOAuthManager } from "../../../integrations/openai-codex/oauth"
import { getLayeredTools } from "../../../core/prompts/tools/native-tools"

describe("OpenAiCodexHandler.getModel", () => {
	it.each(["gpt-5.1", "gpt-5", "gpt-5.1-codex", "gpt-5-codex", "gpt-5-codex-mini", "gpt-5.3-codex-spark"])(
		"should return specified model when a valid model id is provided: %s",
		(apiModelId) => {
			const handler = new OpenAiCodexHandler({ apiModelId })
			const model = handler.getModel()

			expect(model.id).toBe(apiModelId)
			expect(model.info).toBeDefined()
			// Default reasoning effort for GPT-5 family
			expect(model.info.reasoningEffort).toBe("medium")
		},
	)

	it("should fall back to default model when an invalid model id is provided", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "not-a-real-model" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.6-sol")
		expect(model.info).toBeDefined()
	})

	it("should use Spark-specific limits and capabilities", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex-spark" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.3-codex-spark")
		expect(model.info.contextWindow).toBe(128000)
		expect(model.info.maxTokens).toBe(8192)
		expect(model.info.supportsImages).toBe(false)
	})

	it("should use GPT-5.4 Mini capabilities when selected", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.4-mini" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.4-mini")
		expect(model.info).toBeDefined()
	})
})

describe("OpenAiCodexHandler.createMessage", () => {
	it("sends layered gateway schemas with every property required", async () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.6-sol" })

		vitest.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vitest.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		let capturedBody: any
		;(handler as any).client = {
			responses: {
				create: vitest.fn().mockImplementation(async (body: any) => {
					capturedBody = body
					return {
						async *[Symbol.asyncIterator]() {
							yield {
								type: "response.completed",
								response: {
									id: "r1",
									status: "completed",
									output: [],
									usage: { input_tokens: 1, output_tokens: 1 },
								},
							}
						},
					}
				}),
			},
		}

		const stream = handler.createMessage("system", [{ role: "user", content: "Test tools" }], {
			taskId: "layered-schema-test",
			tools: getLayeredTools(),
		})
		for await (const _ of stream) {
			// consume
		}

		expect(capturedBody.tools.map((tool: any) => tool.name)).toEqual(["search", "documentation", "execute"])
		for (const tool of capturedBody.tools) {
			expect(tool.strict).toBe(true)
			expect(tool.parameters.required).toEqual(Object.keys(tool.parameters.properties))
		}
		expect(capturedBody.tools.find((tool: any) => tool.name === "execute").parameters).toMatchObject({
			properties: { tool_id: { type: "string" }, input: { type: "string" } },
			required: ["tool_id", "input"],
		})
	})

	it("replaces stale execute schemas before sending them to Codex", async () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.6-sol" })

		vitest.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vitest.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		let capturedBody: any
		;(handler as any).client = {
			responses: {
				create: vitest.fn().mockImplementation(async (body: any) => {
					capturedBody = body
					return {
						async *[Symbol.asyncIterator]() {
							yield {
								type: "response.completed",
								response: { id: "r1", status: "completed", output: [] },
							}
						},
					}
				}),
			},
		}

		const staleExecute = {
			type: "function" as const,
			function: {
				name: "execute",
				description: "stale",
				parameters: {
					type: "object",
					properties: { tool_id: { type: "string" }, arguments: { type: "object" } },
					required: ["tool_id", "arguments"],
					additionalProperties: false,
				},
			},
		}

		const stream = handler.createMessage("system", [{ role: "user", content: "Test stale schema" }], {
			taskId: "stale-schema-test",
			tools: [staleExecute],
		})
		for await (const _ of stream) {
			// consume
		}

		const execute = capturedBody.tools[0]
		expect(execute.parameters).toEqual({
			type: "object",
			properties: {
				tool_id: { type: "string", description: "The exact stable tool ID returned by search." },
				input: {
					type: "string",
					description:
						'The target tool arguments as a JSON object serialized into a string. Use "{}" for a zero-argument tool.',
				},
			},
			required: ["tool_id", "input"],
			additionalProperties: false,
		})
	})

	it("should skip URL-sourced images in formatFullConversation (only base64 emits input_image)", async () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.1-codex" })

		vitest.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vitest.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		const capturedInput: any[] = []
		;(handler as any).client = {
			responses: {
				create: vitest.fn().mockImplementation(async (body: any) => {
					capturedInput.push(...(body.input ?? []))
					return {
						async *[Symbol.asyncIterator]() {
							yield {
								type: "response.completed",
								response: {
									id: "r1",
									status: "completed",
									output: [],
									usage: { input_tokens: 1, output_tokens: 1 },
								},
							}
						},
					}
				}),
			},
		}

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this:" },
					{ type: "image", source: { type: "url", url: "https://example.com/img.png" } as any },
				],
			},
		]

		const stream = handler.createMessage("system", messages)
		for await (const _ of stream) {
			// consume
		}

		// URL image is skipped; only the text input_text block should be present
		const userMsg = capturedInput.find((item: any) => item.role === "user")
		expect(userMsg?.content).toEqual([{ type: "input_text", text: "Look at this:" }])
		expect(JSON.stringify(capturedInput)).not.toContain("input_image")
	})

	it("should emit input_image for base64 images in formatFullConversation", async () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.1-codex" })

		vitest.spyOn(openAiCodexOAuthManager, "getAccessToken").mockResolvedValue("test-token")
		vitest.spyOn(openAiCodexOAuthManager, "getAccountId").mockResolvedValue("acct_test")

		const capturedInput: any[] = []
		;(handler as any).client = {
			responses: {
				create: vitest.fn().mockImplementation(async (body: any) => {
					capturedInput.push(...(body.input ?? []))
					return {
						async *[Symbol.asyncIterator]() {
							yield {
								type: "response.completed",
								response: {
									id: "r1",
									status: "completed",
									output: [],
									usage: { input_tokens: 1, output_tokens: 1 },
								},
							}
						},
					}
				}),
			},
		}

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this:" },
					{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc123" } },
				],
			},
		]

		const stream = handler.createMessage("system", messages)
		for await (const _ of stream) {
			// consume
		}

		const userMsg = capturedInput.find((item: any) => item.role === "user")
		expect(userMsg?.content).toContainEqual({
			type: "input_image",
			image_url: "data:image/png;base64,abc123",
		})
	})
})
