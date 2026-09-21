import type OpenAI from "openai"

import { buildLayeredToolRegistry } from "../registry"

function tool(name: string, description = `${name} description`): OpenAI.Chat.ChatCompletionFunctionTool {
	return {
		type: "function",
		function: { name, description, parameters: { type: "object", properties: {} } },
	}
}

describe("buildLayeredToolRegistry", () => {
	it("retains source-aware adapter identities and normalized schemas", () => {
		const registry = buildLayeredToolRegistry({
			nativeTools: [tool("read_file")],
			mcpTools: [{ definition: tool("mcp_GitHub_create_issue"), serverName: "GitHub", toolName: "create_issue" }],
			customTools: [tool("deploy")],
		})

		expect(registry.entries.map(({ id }) => id)).toEqual([
			"native:read_file",
			"mcp:github:create_issue",
			"custom:deploy",
		])
		expect(registry.byId.get("mcp:github:create_issue")?.adapter).toEqual({
			kind: "mcp",
			serverName: "GitHub",
			toolName: "create_issue",
		})
		expect(registry.byId.get("native:read_file")?.aliases).toEqual([])
		expect(registry.byId.get("native:read_file")?.semantic).toMatchObject({
			readOnly: true,
			mutating: false,
			network: false,
		})
	})

	it("excludes gateway tools from recursive execution targets", () => {
		const registry = buildLayeredToolRegistry({
			nativeTools: [tool("search"), tool("documentation"), tool("execute"), tool("read_file")],
			mcpTools: [],
			customTools: [],
		})
		expect(registry.entries.map(({ canonicalName }) => canonicalName)).toEqual(["read_file"])
	})

	it("marks isolation and terminal semantics without display-name inference", () => {
		const registry = buildLayeredToolRegistry({
			nativeTools: [tool("new_task"), tool("attempt_completion"), tool("request_condense_context")],
			mcpTools: [],
			customTools: [],
		})

		expect(registry.byId.get("native:new_task")?.semantic.isolated).toBe(true)
		expect(registry.byId.get("native:attempt_completion")?.semantic.terminal).toBe(true)
		expect(registry.byId.get("native:request_condense_context")?.semantic).toMatchObject({
			isolated: true,
			condensesContext: true,
			mutating: true,
		})
	})
})
