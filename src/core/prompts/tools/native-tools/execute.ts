import type OpenAI from "openai"

const execute: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "execute",
		description:
			'Execute exactly one currently available tool by stable ID. Pass the target tool input as a JSON object serialized into the input string; use "{}" for a zero-argument tool. The target tool\'s existing validation, approval, restrictions, terminal behavior, and result format still apply.',
		strict: true,
		parameters: {
			type: "object",
			properties: {
				tool_id: {
					type: "string",
					description: "The exact stable tool ID returned by search.",
				},
				input: {
					type: "string",
					description:
						'A JSON object serialized as a string and matching the target tool\'s documented input_schema. For example: "{\\"path\\":\\".\\",\\"recursive\\":false}". Pass "{}" for a zero-argument tool. Never pass a nested object.',
				},
			},
			required: ["tool_id", "input"],
			additionalProperties: false,
		},
	},
}

export default execute
