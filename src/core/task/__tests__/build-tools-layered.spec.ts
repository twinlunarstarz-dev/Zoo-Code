import type { ClineProvider } from "../../webview/ClineProvider"

const mocks = vi.hoisted(() => ({
	getAllSerialized: vi.fn(() => []),
	loadFromDirectoriesIfStale: vi.fn(async () => undefined),
}))

vi.mock("@roo-code/core", () => ({
	customToolRegistry: {
		getAllSerialized: mocks.getAllSerialized,
		loadFromDirectoriesIfStale: mocks.loadFromDirectoriesIfStale,
	},
	formatNative: vi.fn(),
}))

vi.mock("../../../services/roo-config/index.js", () => ({
	getRooDirectoriesForCwd: vi.fn(() => []),
}))

vi.mock("../../../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn(() => ({
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
		})),
	},
}))

import { buildNativeToolsArrayWithRestrictions } from "../build-tools"

function names(tools: Awaited<ReturnType<typeof buildNativeToolsArrayWithRestrictions>>["tools"]): string[] {
	return tools.map((tool) => ("function" in tool ? tool.function.name : ""))
}

function provider(): ClineProvider {
	return {
		context: {},
		getMcpHub: () => ({ getServers: () => [] }),
	} as unknown as ClineProvider
}

const baseOptions = {
	provider: provider(),
	cwd: "C:/workspace",
	mode: "code",
	customModes: undefined,
	experiments: {},
	apiConfiguration: undefined,
}

describe("buildNativeToolsArrayWithRestrictions layered protocol", () => {
	it("leaves direct provider definitions unchanged and builds an internal registry", async () => {
		const result = await buildNativeToolsArrayWithRestrictions({ ...baseOptions, toolProtocol: "direct" })

		expect(names(result.tools)).toContain("read_file")
		expect(names(result.tools)).not.toEqual(["search", "documentation", "execute"])
		expect(result.allowedFunctionNames).toBeUndefined()
		expect(result.layeredRegistry.byId.get("native:read_file")).toBeDefined()
	})

	it("exposes only the fixed gateway while retaining filtered internal targets", async () => {
		const result = await buildNativeToolsArrayWithRestrictions({ ...baseOptions, toolProtocol: "layered" })

		expect(names(result.tools)).toEqual(["search", "documentation", "execute"])
		expect(result.layeredRegistry.byId.get("native:read_file")).toBeDefined()
		expect(result.layeredRegistry.entries.some(({ canonicalName }) => canonicalName === "execute")).toBe(false)
	})

	it("exposes no gateways when layered tools are disabled for the mode", async () => {
		const result = await buildNativeToolsArrayWithRestrictions({
			...baseOptions,
			mode: "no-layered",
			customModes: [
				{
					slug: "no-layered",
					name: "No Layered Tools",
					roleDefinition: "Test mode",
					groups: ["read"],
					layeredTools: false,
				},
			],
			toolProtocol: "layered",
		})

		expect(names(result.tools)).toEqual([])
		expect(result.layeredRegistry.byId.get("native:read_file")).toBeDefined()
	})

	it("restricts Gemini layered calls to exactly the gateway names", async () => {
		const result = await buildNativeToolsArrayWithRestrictions({
			...baseOptions,
			toolProtocol: "layered",
			includeAllToolsWithRestrictions: true,
		})

		expect(names(result.tools)).toEqual(["search", "documentation", "execute"])
		expect(result.allowedFunctionNames).toEqual(["search", "documentation", "execute"])
	})

	it("applies disabled tools before registry construction", async () => {
		const result = await buildNativeToolsArrayWithRestrictions({
			...baseOptions,
			toolProtocol: "layered",
			disabledTools: ["read_file"],
		})

		expect(result.layeredRegistry.byId.has("native:read_file")).toBe(false)
	})

	it("keeps enabled MCP tools internal to the layered registry", async () => {
		const mcpProvider = {
			context: {},
			getMcpHub: () => ({
				getServers: () => [
					{
						name: "GitHub",
						disabled: false,
						status: "connected",
						tools: [
							{
								name: "create_issue",
								description: "Create an issue",
								inputSchema: { type: "object", properties: {} },
								enabledForPrompt: true,
							},
						],
					},
				],
			}),
		} as unknown as ClineProvider
		const result = await buildNativeToolsArrayWithRestrictions({
			...baseOptions,
			provider: mcpProvider,
			toolProtocol: "layered",
		})

		expect(names(result.tools)).toEqual(["search", "documentation", "execute"])
		expect(result.layeredRegistry.byId.get("mcp:github:create_issue")?.adapter).toEqual({
			kind: "mcp",
			serverName: "GitHub",
			toolName: "create_issue",
		})
	})
})
