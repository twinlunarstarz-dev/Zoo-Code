import type { LayeredToolCandidate, LayeredToolEntry, LayeredToolSourceKind } from "./types"

const SOURCE_ORDER: Record<LayeredToolSourceKind, number> = {
	native: 0,
	mcp: 1,
	custom: 2,
}

function compareText(left: string, right: string): number {
	const foldedComparison = left.toLowerCase().localeCompare(right.toLowerCase(), "en")
	return foldedComparison || left.localeCompare(right, "en")
}

export function escapeLayeredToolIdSegment(segment: string): string {
	if (segment.length === 0) {
		return "%00"
	}

	return encodeURIComponent(segment)
		.replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)
		.toLowerCase()
}

export function compareLayeredToolCandidates(left: LayeredToolCandidate, right: LayeredToolCandidate): number {
	return (
		SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
		compareText(left.displayName, right.displayName) ||
		compareText(left.sourceName ?? "", right.sourceName ?? "") ||
		compareText(left.canonicalName, right.canonicalName)
	)
}

function baseLayeredToolId(candidate: LayeredToolCandidate): string {
	if (candidate.source === "mcp") {
		return `mcp:${escapeLayeredToolIdSegment(candidate.sourceName ?? "")}:${escapeLayeredToolIdSegment(candidate.canonicalName)}`
	}

	return `${candidate.source}:${escapeLayeredToolIdSegment(candidate.canonicalName)}`
}

export function assignLayeredToolIds(candidates: LayeredToolCandidate[]): LayeredToolEntry[] {
	const collisionCounts = new Map<string, number>()

	return [...candidates].sort(compareLayeredToolCandidates).map((candidate) => {
		const baseId = baseLayeredToolId(candidate)
		const count = (collisionCounts.get(baseId) ?? 0) + 1
		collisionCounts.set(baseId, count)

		return {
			...candidate,
			id: count === 1 ? baseId : `${baseId}~${count}`,
		}
	})
}
