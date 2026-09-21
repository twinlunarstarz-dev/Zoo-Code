import type OpenAI from "openai"

import { assignLayeredToolIds, escapeLayeredToolIdSegment } from "../id"
import type { LayeredToolCandidate } from "../types"

const definition: OpenAI.Chat.ChatCompletionFunctionTool = {
	type: "function",
	function: { name: "tool", parameters: { type: "object" } },
}

function candidate(overrides: Partial<LayeredToolCandidate> = {}): LayeredToolCandidate {
	return {
		source: "native",
		canonicalName: "read_file",
		displayName: "read_file",
		description: "Read a file",
		inputSchema: { type: "object" },
		providerDefinition: definition,
		adapter: { kind: "native", toolName: "read_file" },
		aliases: [],
		semantic: {
			isolated: false,
			terminal: false,
			condensesContext: false,
			readOnly: true,
			mutating: false,
			network: false,
		},
		...overrides,
	}
}

describe("layered tool IDs", () => {
	it("escapes delimiters and case deterministically", () => {
		expect(escapeLayeredToolIdSegment("GitHub:Create Issue")).toBe("github%3acreate%20issue")
	})

	it("assigns readable namespaced IDs", () => {
		const [native, mcp, custom] = assignLayeredToolIds([
			candidate(),
			candidate({
				source: "mcp",
				sourceName: "GitHub API",
				canonicalName: "create_issue",
				displayName: "create_issue",
				adapter: { kind: "mcp", serverName: "GitHub API", toolName: "create_issue" },
			}),
			candidate({
				source: "custom",
				canonicalName: "deploy",
				displayName: "deploy",
				adapter: { kind: "custom", toolName: "deploy" },
			}),
		])

		expect(native?.id).toBe("native:read_file")
		expect(mcp?.id).toBe("mcp:github%20api:create_issue")
		expect(custom?.id).toBe("custom:deploy")
	})

	it("uses stable collision suffixes after deterministic sorting", () => {
		const first = candidate({ displayName: "A", canonicalName: "Same" })
		const second = candidate({ displayName: "B", canonicalName: "same" })
		const ids = assignLayeredToolIds([second, first]).map(({ id }) => id)
		expect(ids).toEqual(["native:same", "native:same~2"])
	})
})
