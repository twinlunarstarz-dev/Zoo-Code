import { getLayeredTools } from "../layered"
import { getNativeTools } from "../index"

type FunctionTool = ReturnType<typeof getLayeredTools>[number] & { type: "function" }

function functions(): FunctionTool["function"][] {
	return getLayeredTools().map((tool) => (tool as FunctionTool).function)
}

describe("layered gateway tool definitions", () => {
	it("exposes exactly the fixed three-tool catalog", () => {
		expect(functions().map(({ name }) => name)).toEqual(["search", "documentation", "execute"])
	})

	it("uses strict closed envelopes", () => {
		for (const definition of functions()) {
			expect(definition.strict).toBe(true)
			expect(definition.parameters).toMatchObject({
				type: "object",
				additionalProperties: false,
			})
		}
	})

	it("uses provider-portable required envelopes", () => {
		const [search, documentation, execute] = functions()
		expect(search.parameters).toMatchObject({ required: ["query"] })
		expect(documentation.parameters).toMatchObject({ required: ["tool_id"] })
		expect(execute.parameters).toMatchObject({ required: ["tool_id", "input"] })
		for (const definition of functions()) {
			const parameters = definition.parameters as { properties: Record<string, unknown>; required: string[] }
			expect(parameters.required).toEqual(Object.keys(parameters.properties))
		}
	})

	it("uses a non-reserved JSON string input field so providers preserve dynamic target fields", () => {
		const execute = functions()[2]
		expect(execute.parameters).toMatchObject({
			properties: {
				input: {
					type: "string",
				},
			},
		})
	})

	it("instructs models to pass an empty JSON object string for zero-argument tools", () => {
		const execute = functions()[2]
		expect(execute.description).toContain('"{}"')
		expect(execute.parameters).toMatchObject({
			properties: {
				input: {
					description: expect.stringContaining('"{}"'),
				},
			},
		})
	})

	it("does not add gateway tools to the direct native catalog", () => {
		const directNames = getNativeTools().map((tool) => (tool as FunctionTool).function.name)
		expect(directNames).not.toContain("search")
		expect(directNames).not.toContain("documentation")
		expect(directNames).not.toContain("execute")
	})
})
