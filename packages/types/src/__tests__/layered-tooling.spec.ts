import {
	experimentIds,
	experimentsSchema,
	historyItemSchema,
	toolNamesSchema,
	toolProtocolSchema,
	type CreateTaskOptions,
} from "../index.js"

const legacyHistoryItem = {
	id: "task-1",
	number: 1,
	ts: 1,
	task: "Legacy task",
	tokensIn: 0,
	tokensOut: 0,
	totalCost: 0,
}

describe("layered tooling shared types", () => {
	it("registers the layered tooling experiment as optional", () => {
		expect(experimentIds).toContain("layeredTooling")
		expect(experimentsSchema.parse({})).toEqual({})
		expect(experimentsSchema.parse({ layeredTooling: true })).toEqual({ layeredTooling: true })
	})

	it.each(["direct", "layered"])("accepts the %s tool protocol", (protocol) => {
		expect(toolProtocolSchema.parse(protocol)).toBe(protocol)
	})

	it("rejects unknown tool protocols", () => {
		expect(toolProtocolSchema.safeParse("automatic").success).toBe(false)
	})

	it("keeps legacy history items backward compatible", () => {
		expect(historyItemSchema.parse(legacyHistoryItem)).toEqual(legacyHistoryItem)
	})

	it.each(["direct", "layered"])("persists the %s protocol in history", (toolProtocol) => {
		expect(historyItemSchema.parse({ ...legacyHistoryItem, toolProtocol }).toolProtocol).toBe(toolProtocol)
	})

	it("rejects invalid persisted protocols", () => {
		expect(historyItemSchema.safeParse({ ...legacyHistoryItem, toolProtocol: "unknown" }).success).toBe(false)
	})

	it("allows task creation to provide an explicit protocol", () => {
		const options: CreateTaskOptions = { toolProtocol: "layered" }
		expect(options.toolProtocol).toBe("layered")
	})

	it.each(["search", "documentation", "execute"])("registers the %s gateway tool name", (toolName) => {
		expect(toolNamesSchema.parse(toolName)).toBe(toolName)
	})
})
