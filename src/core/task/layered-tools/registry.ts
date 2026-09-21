import type OpenAI from "openai"

import { getToolAliasGroup, resolveToolAlias } from "../../prompts/tools/filter-tools-for-mode"

import { assignLayeredToolIds } from "./id"
import type {
	LayeredToolCandidate,
	LayeredToolRegistry,
	LayeredToolSemanticFlags,
	LayeredToolSourceKind,
} from "./types"

export const LAYERED_GATEWAY_TOOL_NAMES = new Set(["search", "documentation", "execute"])

const DEFAULT_SCHEMA: OpenAI.FunctionParameters = {
	type: "object",
	additionalProperties: false,
}

const READ_ONLY_TOOLS = new Set([
	"read_file",
	"list_files",
	"codebase_search",
	"search_files",
	"read_command_output",
	"chat_history_lookup",
	"access_mcp_resource",
	"documentation",
	"search",
])

const NETWORK_TOOLS = new Set(["use_mcp_tool", "access_mcp_resource", "run_slash_command"])

function semanticFlags(name: string): LayeredToolSemanticFlags {
	const canonicalName = resolveToolAlias(name)
	const readOnly = READ_ONLY_TOOLS.has(canonicalName)
	return {
		isolated: canonicalName === "new_task" || canonicalName === "request_condense_context",
		terminal: canonicalName === "attempt_completion",
		condensesContext: canonicalName === "request_condense_context",
		readOnly,
		mutating: !readOnly,
		network: NETWORK_TOOLS.has(canonicalName),
	}
}

export function aliasesForTool(name: string): readonly string[] {
	return getToolAliasGroup(name).filter((alias) => alias !== name)
}

function toFunctionTool(tool: OpenAI.Chat.ChatCompletionTool): OpenAI.Chat.ChatCompletionFunctionTool | undefined {
	return "function" in tool && tool.function ? (tool as OpenAI.Chat.ChatCompletionFunctionTool) : undefined
}

export interface McpLayeredToolDefinition {
	definition: OpenAI.Chat.ChatCompletionFunctionTool
	serverName: string
	toolName: string
}

function candidateFromProviderDefinition(
	tool: OpenAI.Chat.ChatCompletionTool,
	source: Exclude<LayeredToolSourceKind, "mcp">,
): LayeredToolCandidate | undefined {
	const definition = toFunctionTool(tool)
	if (!definition || LAYERED_GATEWAY_TOOL_NAMES.has(definition.function.name)) {
		return undefined
	}

	const callableName = definition.function.name
	const canonicalName = source === "native" ? resolveToolAlias(callableName) : callableName
	return {
		source,
		canonicalName,
		displayName: callableName,
		description: definition.function.description ?? "",
		inputSchema: definition.function.parameters ?? DEFAULT_SCHEMA,
		providerDefinition: definition,
		aliases: aliasesForTool(canonicalName),
		adapter: { kind: source, toolName: canonicalName },
		semantic: semanticFlags(canonicalName),
	}
}

export interface BuildLayeredToolRegistryOptions {
	nativeTools: OpenAI.Chat.ChatCompletionTool[]
	mcpTools: McpLayeredToolDefinition[]
	customTools: OpenAI.Chat.ChatCompletionTool[]
}

export function buildLayeredToolRegistry(options: BuildLayeredToolRegistryOptions): LayeredToolRegistry {
	const candidates: LayeredToolCandidate[] = []

	for (const tool of options.nativeTools) {
		const candidate = candidateFromProviderDefinition(tool, "native")
		if (candidate) candidates.push(candidate)
	}

	for (const tool of options.mcpTools) {
		if (LAYERED_GATEWAY_TOOL_NAMES.has(tool.definition.function.name)) continue
		candidates.push({
			source: "mcp",
			sourceName: tool.serverName,
			canonicalName: tool.toolName,
			displayName: tool.toolName,
			description: tool.definition.function.description ?? "",
			inputSchema: tool.definition.function.parameters ?? DEFAULT_SCHEMA,
			providerDefinition: tool.definition,
			aliases: aliasesForTool(tool.toolName),
			adapter: { kind: "mcp", serverName: tool.serverName, toolName: tool.toolName },
			semantic: semanticFlags(tool.toolName),
		})
	}

	for (const tool of options.customTools) {
		const candidate = candidateFromProviderDefinition(tool, "custom")
		if (candidate) candidates.push(candidate)
	}

	const entries = assignLayeredToolIds(candidates)
	return {
		entries,
		byId: new Map(entries.map((entry) => [entry.id, entry])),
	}
}
