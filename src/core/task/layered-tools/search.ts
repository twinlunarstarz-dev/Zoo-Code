import type { LayeredToolEntry, LayeredToolRegistry, LayeredToolSearchOptions, LayeredToolSearchResult } from "./types"

function scoreField(field: string, token: string, weight: number): number {
	const normalized = field.toLowerCase()
	if (normalized === token) return weight * 4
	if (normalized.startsWith(token)) return weight * 2
	if (normalized.includes(token)) return weight
	return 0
}

function scoreEntry(entry: LayeredToolEntry, tokens: string[], includeAliases: boolean): number {
	let total = 0
	for (const token of tokens) {
		const tokenScore = Math.max(
			scoreField(entry.id, token, 12),
			scoreField(entry.displayName, token, 10),
			scoreField(entry.canonicalName, token, 9),
			scoreField(entry.source, token, 5),
			scoreField(entry.sourceName ?? "", token, 7),
			scoreField(entry.description, token, 2),
			...(includeAliases ? entry.aliases.map((alias) => scoreField(alias, token, 8)) : []),
		)
		// OR logic: accumulate score for matching tokens, don't require all tokens to match
		if (tokenScore > 0) {
			total += tokenScore
		}
	}
	return total
}

export function searchLayeredToolRegistry(
	registry: LayeredToolRegistry,
	query: string,
	options: LayeredToolSearchOptions | number = {},
): LayeredToolSearchResult[] {
	const normalizedOptions = typeof options === "number" ? { limit: options } : options
	const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
	const boundedLimit = Math.max(1, Math.min(50, Math.floor(normalizedOptions.limit ?? 10)))
	const includeAliases = normalizedOptions.includeAliases ?? true
	const includeDetails = normalizedOptions.includeDetails ?? false

	const matches = registry.entries
		.map((entry) => ({ entry, score: tokens.length === 0 ? 0 : scoreEntry(entry, tokens, includeAliases) }))
		.filter(({ score }) => tokens.length === 0 || score > 0)

	if (tokens.length > 0) {
		matches.sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id, "en"))
	}

	return matches.slice(0, tokens.length === 0 ? matches.length : boundedLimit).map(({ entry, score }) => ({
		id: entry.id,
		name: entry.displayName,
		aliases: entry.aliases,
		source: entry.source,
		sourceName: entry.sourceName,
		...(includeDetails ? { description: entry.description, inputSchema: entry.inputSchema } : {}),
		semantic: entry.semantic,
		score,
	}))
}
