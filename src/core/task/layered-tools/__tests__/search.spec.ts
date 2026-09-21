import type OpenAI from "openai"

import { buildLayeredToolRegistry } from "../registry"
import { searchLayeredToolRegistry } from "../search"

function tool(name: string, description: string): OpenAI.Chat.ChatCompletionFunctionTool {
	return { type: "function", function: { name, description, parameters: { type: "object" } } }
}

const registry = buildLayeredToolRegistry({
	nativeTools: [tool("read_file", "Read file contents"), tool("search_files", "Search with regular expressions")],
	mcpTools: [
		{
			definition: tool("mcp_GitHub_create_issue", "Create an issue in a repository"),
			serverName: "GitHub",
			toolName: "create_issue",
		},
	],
	customTools: [tool("deploy", "Deploy the application")],
})

describe("searchLayeredToolRegistry", () => {
	it("returns every ID and name in registry order for an empty query", () => {
		expect(searchLayeredToolRegistry(registry, "").map(({ id }) => id)).toEqual(
			registry.entries.map(({ id }) => id),
		)
	})

	it("searches source metadata and description case-insensitively", () => {
		expect(searchLayeredToolRegistry(registry, "GITHUB issue")[0]).toMatchObject({
			id: "mcp:github:create_issue",
			name: "create_issue",
		})
	})

	it("matches canonical aliases without exposing full details by default", () => {
		const aliasRegistry = buildLayeredToolRegistry({
			nativeTools: [tool("edit", "Edit text")],
			mcpTools: [],
			customTools: [],
		})

		expect(searchLayeredToolRegistry(aliasRegistry, "search_and_replace")[0]).toMatchObject({
			id: "native:edit",
			name: "edit",
			aliases: ["search_and_replace"],
		})
		expect(searchLayeredToolRegistry(aliasRegistry, "edit")[0]?.description).toBeUndefined()
		expect(searchLayeredToolRegistry(aliasRegistry, "edit", { includeDetails: true })[0]?.description).toBe(
			"Edit text",
		)
	})

	it("uses stable ordering and bounds non-empty results", () => {
		const results = searchLayeredToolRegistry(registry, "file", 1)
		expect(results).toHaveLength(1)
		expect(results[0]?.id).toBe("native:read_file")
	})

	it("defaults to 25 non-empty results", () => {
		const largeRegistry = buildLayeredToolRegistry({
			nativeTools: Array.from({ length: 30 }, (_, index) => tool(`tool_${index}`, "matching tool")),
			mcpTools: [],
			customTools: [],
		})

		expect(searchLayeredToolRegistry(largeRegistry, "matching")).toHaveLength(25)
	})
})
