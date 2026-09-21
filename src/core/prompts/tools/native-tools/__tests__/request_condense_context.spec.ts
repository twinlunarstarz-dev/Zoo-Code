import { toolNamesSchema } from "@roo-code/types"

import { ALWAYS_AVAILABLE_TOOLS } from "../../../../../shared/tools"
import { getNativeTools } from "../index"

describe("request_condense_context native tool", () => {
	it("exposes a strict zero-argument schema", () => {
		const tool = getNativeTools().find(
			(candidate) => "function" in candidate && candidate.function.name === "request_condense_context",
		)

		expect(tool).toBeDefined()
		expect(tool).toMatchObject({
			type: "function",
			function: {
				name: "request_condense_context",
				strict: true,
				parameters: {
					type: "object",
					properties: {},
					required: [],
					additionalProperties: false,
				},
			},
		})
	})

	it("is a valid tool name that is always available", () => {
		expect(toolNamesSchema.parse("request_condense_context")).toBe("request_condense_context")
		expect(ALWAYS_AVAILABLE_TOOLS).toContain("request_condense_context")
	})
})
