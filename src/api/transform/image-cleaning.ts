import { ApiMessage } from "../../core/task-persistence/apiMessages"

import { ApiHandler } from "../index"

/* Removes image blocks from messages if they are not supported by the Api Handler */
export function maybeRemoveImageBlocks(messages: ApiMessage[], apiHandler: ApiHandler): ApiMessage[] {
	const hasImageBlock = (content: unknown): boolean =>
		Array.isArray(content) &&
		content.some(
			(block) => block?.type === "image" || (block?.type === "tool_result" && hasImageBlock(block.content)),
		)

	if (!messages.some((message) => Array.isArray(message.content))) {
		return messages
	}

	// Check model capability ONCE instead of for every message. Some lightweight test
	// handlers do not expose model metadata; retain the historical text-only fallback.
	const supportsImages = apiHandler.getModel?.().info.supportsImages ?? false
	if (!messages.some((message) => hasImageBlock(message.content))) {
		return messages
	}
	if (supportsImages) return messages

	const replaceImageBlocks = (content: unknown): unknown => {
		if (!Array.isArray(content)) return content

		return content.map((block) => {
			if (block?.type === "image") {
				return {
					type: "text",
					text: "[Referenced image in conversation]",
				}
			}
			if (block?.type === "tool_result" && Array.isArray(block.content)) {
				return { ...block, content: replaceImageBlocks(block.content) }
			}
			return block
		})
	}

	return messages.map((message) => ({
		...message,
		content: replaceImageBlocks(message.content) as ApiMessage["content"],
	}))
}
