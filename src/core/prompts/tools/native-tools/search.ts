import type OpenAI from "openai"

const search: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "search",
		description:
			"Search the tools currently available to this task. Pass an empty query to list every available tool ID and name, or non-empty text for compact ranked matches. Use documentation with a returned ID before execute when the contract is not already known.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Case-insensitive search text. Pass an empty string to list all IDs and names.",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
}

export default search
