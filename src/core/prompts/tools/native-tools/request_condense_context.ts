import type OpenAI from "openai"

const DESCRIPTION = `Request an early condensation of the conversation context at a logical boundary, such as after completing a coherent task or phase. This can reduce the chance that automatic context condensation happens in the middle of later work. Automatic condensation remains enabled.

CRITICAL: This tool MUST be called alone. Do NOT call this tool alongside other tools in the same assistant turn.`

export default {
	type: "function",
	function: {
		name: "request_condense_context",
		description: DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
