import type OpenAI from "openai"

const documentation: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "documentation",
		description:
			"Read the complete current contract for one available tool ID returned by search, including its description, source, argument schema, and execute instructions.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				tool_id: {
					type: "string",
					description: "The exact stable tool ID returned by search.",
				},
			},
			required: ["tool_id"],
			additionalProperties: false,
		},
	},
}

export default documentation
