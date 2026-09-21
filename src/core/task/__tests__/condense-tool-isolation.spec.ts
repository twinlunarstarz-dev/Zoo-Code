import type { Anthropic } from "@anthropic-ai/sdk"

import { enforceCondenseToolTurnIsolation } from "../toolTurnIsolation"
import type { LayeredToolRegistry } from "../layered-tools"

const tool = (id: string, name: string, input: Record<string, unknown> = {}): Anthropic.ToolUseBlockParam => ({
	type: "tool_use",
	id,
	name,
	input,
})

describe("request_condense_context turn isolation", () => {
	const layeredRegistry: LayeredToolRegistry = {
		entries: [],
		byId: new Map([
			[
				"native:request_condense_context",
				{
					id: "native:request_condense_context",
					source: "native",
					canonicalName: "request_condense_context",
					displayName: "request_condense_context",
					description: "Condense context",
					inputSchema: {},
					providerDefinition: { type: "function", function: { name: "request_condense_context" } },
					adapter: { kind: "native", toolName: "request_condense_context" },
					aliases: [],
					semantic: {
						isolated: true,
						terminal: false,
						condensesContext: true,
						readOnly: false,
						mutating: true,
						network: false,
					},
				},
			],
		]),
	}

	it("isolates layered execute calls targeting request_condense_context", () => {
		const content = [
			tool("execute-1", "execute", { tool_id: "native:request_condense_context", input: "{}" }),
			tool("execute-2", "execute", { tool_id: "native:read_file", input: '{"path":"README.md"}' }),
		]

		const result = enforceCondenseToolTurnIsolation(content, layeredRegistry)

		expect(result.executionContent).toEqual([content[0]])
		expect(result.injectedToolResults).toEqual([
			expect.objectContaining({ tool_use_id: "execute-2", is_error: true }),
		])
	})
	it("leaves an isolated condensation call unchanged", () => {
		const content = [tool("condense-1", "request_condense_context")]

		const result = enforceCondenseToolTurnIsolation(content)

		expect(result.executionContent).toEqual(content)
		expect(result.injectedToolResults).toEqual([])
	})

	it("suppresses later sibling tools when condensation is the first tool", () => {
		const content = [
			tool("condense-1", "request_condense_context"),
			tool("read-1", "read_file"),
			tool("write-1", "write_to_file"),
		]

		const result = enforceCondenseToolTurnIsolation(content)

		expect(result.executionContent).toEqual([content[0]])
		expect(result.injectedToolResults).toHaveLength(2)
		expect(result.injectedToolResults.map((item) => item.tool_use_id)).toEqual(["read-1", "write-1"])
		expect(result.injectedToolResults.every((item) => item.is_error)).toBe(true)
		expect(result.injectedToolResults[0].content).toContain("must be the only tool call")
	})

	it("does not suppress content when an earlier tool precedes condensation", () => {
		const content = [tool("read-1", "read_file"), tool("condense-1", "request_condense_context")]

		const result = enforceCondenseToolTurnIsolation(content)

		expect(result.executionContent).toEqual(content)
		expect(result.injectedToolResults).toEqual([])
	})

	it("keeps intervening text before the first tool", () => {
		const text: Anthropic.TextBlockParam = { type: "text", text: "Boundary reached." }
		const content = [text, tool("condense-1", "request_condense_context"), tool("read-1", "read_file")]

		const result = enforceCondenseToolTurnIsolation(content)

		expect(result.executionContent).toEqual([text, content[1]])
		expect(result.injectedToolResults).toHaveLength(1)
	})
})
