import type OpenAI from "openai"

import documentation from "./documentation"
import execute from "./execute"
import search from "./search"

/** The complete and intentionally fixed provider-visible catalog for layered tasks. */
export const layeredTools = [search, documentation, execute] satisfies OpenAI.Chat.ChatCompletionTool[]

export function getLayeredTools(): OpenAI.Chat.ChatCompletionTool[] {
	return [...layeredTools]
}
