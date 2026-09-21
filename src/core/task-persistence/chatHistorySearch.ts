import * as fs from "fs/promises"
import * as path from "path"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { fileExistsAtPath } from "../../utils/fs"
import { getStorageBasePath } from "../../utils/storage"

export interface ChatHistorySearchResult {
	conversationPath: string
	lines: Array<{ line: number; text: string }>
}

const MAX_RESULTS = 20

function searchTerms(query: string): string[] {
	return [
		...new Set(
			query
				.toLowerCase()
				.split(/\s+/)
				.map((term) => term.trim())
				.filter((term) => term.length > 1),
		),
	]
}

/** Searches all persisted API conversation logs, independent of the active workspace. */
export async function searchChatHistory(
	globalStoragePath: string,
	query: string,
	limit = 10,
): Promise<ChatHistorySearchResult[]> {
	const terms = searchTerms(query)
	if (terms.length === 0) return []

	const basePath = await getStorageBasePath(globalStoragePath)
	const tasksPath = path.join(basePath, "tasks")
	let taskDirectories
	try {
		taskDirectories = (await fs.readdir(tasksPath, { withFileTypes: true })).filter((entry) => entry.isDirectory())
	} catch {
		return []
	}

	const results: ChatHistorySearchResult[] = []
	const resultLimit = Math.min(MAX_RESULTS, Math.max(1, Math.floor(limit)))
	for (const taskDirectory of taskDirectories) {
		if (results.length >= resultLimit) break
		const conversationPath = path.join(tasksPath, taskDirectory.name, GlobalFileNames.apiConversationHistory)
		if (!(await fileExistsAtPath(conversationPath))) continue
		let content: string
		try {
			content = await fs.readFile(conversationPath, "utf8")
		} catch {
			continue
		}
		let lines = content
			.split(/\r?\n/)
			.map((text, index) => ({ line: index + 1, text }))
			.filter(({ text }) => terms.some((term) => text.toLowerCase().includes(term)))
		if (lines.length === 0) {
			try {
				const parsed = JSON.parse(content)
				const searchableText = JSON.stringify(parsed)
				if (terms.some((term) => searchableText.toLowerCase().includes(term))) {
					lines = [{ line: 1, text: searchableText }]
				}
			} catch {
				// Ignore malformed or partially-written logs.
			}
		}
		if (lines.length > 0) results.push({ conversationPath, lines: lines.slice(0, 25) })
	}
	return results
}
