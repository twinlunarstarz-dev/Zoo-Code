import type OpenAI from "openai"

export type LayeredToolSourceKind = "native" | "mcp" | "custom"

export interface LayeredToolSemanticFlags {
	isolated: boolean
	terminal: boolean
	condensesContext: boolean
	readOnly: boolean
	mutating: boolean
	network: boolean
}

export type LayeredToolAdapter =
	| { kind: "native"; toolName: string }
	| { kind: "mcp"; serverName: string; toolName: string }
	| { kind: "custom"; toolName: string }

export interface LayeredToolCandidate {
	source: LayeredToolSourceKind
	canonicalName: string
	displayName: string
	description: string
	inputSchema: OpenAI.FunctionParameters
	providerDefinition: OpenAI.Chat.ChatCompletionFunctionTool
	sourceName?: string
	aliases: readonly string[]
	adapter: LayeredToolAdapter
	semantic: LayeredToolSemanticFlags
}

export interface LayeredToolEntry extends LayeredToolCandidate {
	id: string
}

export interface LayeredToolRegistry {
	entries: LayeredToolEntry[]
	byId: ReadonlyMap<string, LayeredToolEntry>
}

export interface LayeredToolSearchResult {
	id: string
	name: string
	aliases: readonly string[]
	source: LayeredToolSourceKind
	sourceName?: string
	description?: string
	inputSchema?: OpenAI.FunctionParameters
	semantic: LayeredToolSemanticFlags
	score: number
}

export interface LayeredToolSearchOptions {
	limit?: number
	includeAliases?: boolean
	includeDetails?: boolean
}
