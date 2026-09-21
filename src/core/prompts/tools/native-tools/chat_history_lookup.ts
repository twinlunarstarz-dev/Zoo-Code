import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "chat_history_lookup",
		description:
			"Search all persisted Roo conversation logs, independent of the current working directory. Returns conversation log paths and matching line numbers and text.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Natural-language semantic search query." },
				limit: { type: "integer", minimum: 1, maximum: 20 },
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
