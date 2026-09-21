import type { Task } from "../../task/Task"
import type { LayeredToolRegistry } from "../../task/layered-tools"
import type { ToolCallbacks } from "../BaseTool"
import type { DispatchToolUseOptions } from "../dispatchToolUse"

const mocks = vi.hoisted(() => ({ dispatchToolUse: vi.fn() }))

vi.mock("../dispatchToolUse", async (importOriginal) => ({
	...(await importOriginal<typeof import("../dispatchToolUse")>()),
	dispatchToolUse: mocks.dispatchToolUse,
}))

import { layeredExecuteTool, type LayeredExecuteCallbacks } from "../LayeredExecuteTool"

function makeTask(toolName: string): Task {
	const entry = {
		id: `native:${toolName}`,
		source: "native" as const,
		canonicalName: toolName,
		displayName: toolName,
		description: `${toolName} description`,
		inputSchema: { type: "object", properties: {} },
		providerDefinition: {
			type: "function" as const,
			function: { name: toolName, description: `${toolName} description`, parameters: {} },
		},
		adapter: { kind: "native" as const, toolName },
		aliases: [],
		semantic: {
			isolated: false,
			terminal: false,
			condensesContext: false,
			readOnly: true,
			mutating: false,
			network: false,
		},
	}
	const registry: LayeredToolRegistry = { entries: [entry], byId: new Map([[entry.id, entry]]) }
	return {
		toolProtocol: "layered",
		buildAllowedLayeredToolRegistry: vi.fn(async () => registry),
		consecutiveMistakeCount: 0,
		recordToolError: vi.fn(),
		didToolFailInCurrentTurn: false,
	} as unknown as Task
}

function makeMcpTask(): Task {
	const entry = {
		id: "mcp:brave-search:brave_web_search",
		source: "mcp" as const,
		canonicalName: "brave_web_search",
		displayName: "brave_web_search",
		description: "Search the web",
		inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
		providerDefinition: {
			type: "function" as const,
			function: { name: "brave_web_search", description: "Search the web", parameters: {} },
		},
		adapter: { kind: "mcp" as const, serverName: "brave-search", toolName: "brave_web_search" },
		aliases: [],
		semantic: {
			isolated: false,
			terminal: false,
			condensesContext: false,
			readOnly: false,
			mutating: true,
			network: true,
		},
	}
	const registry: LayeredToolRegistry = { entries: [entry], byId: new Map([[entry.id, entry]]) }
	return {
		toolProtocol: "layered",
		buildAllowedLayeredToolRegistry: vi.fn(async () => registry),
		consecutiveMistakeCount: 0,
		recordToolError: vi.fn(),
		didToolFailInCurrentTurn: false,
	} as unknown as Task
}

function makeCallbacks(): LayeredExecuteCallbacks {
	const toolCallbacks: ToolCallbacks = {
		askApproval: vi.fn(),
		handleError: vi.fn(),
		pushToolResult: vi.fn(),
		toolCallId: "outer-call",
	}
	return {
		...toolCallbacks,
		dispatchOptions: {
			mode: "code",
			customToolsEnabled: true,
			askFinishSubTaskApproval: vi.fn(),
			toolDescription: vi.fn(),
		} as unknown as LayeredExecuteCallbacks["dispatchOptions"],
	}
}

describe("LayeredExecuteTool", () => {
	beforeEach(() => mocks.dispatchToolUse.mockReset())

	it("normalizes native arguments and preserves the outer call ID", async () => {
		const callbacks = makeCallbacks()
		await layeredExecuteTool.execute(
			{ tool_id: "native:read_file", input: JSON.stringify({ path: "README.md" }) },
			makeTask("read_file"),
			callbacks,
		)

		expect(mocks.dispatchToolUse).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ id: "outer-call", name: "read_file", nativeArgs: { path: "README.md" } }),
			expect.any(Object),
		)
	})

	it("accepts an object argument envelope from providers that emit the documented target schema directly", async () => {
		const callbacks = makeCallbacks()
		await layeredExecuteTool.execute(
			{ tool_id: "native:read_file", input: { path: "README.md" } },
			makeTask("read_file"),
			callbacks,
		)

		expect(mocks.dispatchToolUse).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ id: "outer-call", name: "read_file", nativeArgs: { path: "README.md" } }),
			expect.any(Object),
		)
	})

	it.each([
		{ input: { arguments: { query: "latest TypeScript release" } }, label: "object wrapper" },
		{ input: JSON.stringify({ arguments: { query: "latest TypeScript release" } }), label: "serialized wrapper" },
		{
			input: { arguments: JSON.stringify({ query: "latest TypeScript release" }) },
			label: "serialized arguments",
		},
	])("unwraps the legacy $label without dropping MCP target arguments", async ({ input }) => {
		const callbacks = makeCallbacks()
		await layeredExecuteTool.execute(
			{
				tool_id: "mcp:brave-search:brave_web_search",
				input,
			},
			makeMcpTask(),
			callbacks,
		)

		expect(mocks.dispatchToolUse).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				id: "outer-call",
				name: "use_mcp_tool",
				nativeArgs: {
					server_name: "brave-search",
					tool_name: "brave_web_search",
					arguments: { query: "latest TypeScript release" },
				},
			}),
			expect.any(Object),
		)
	})

	it("returns invalid_arguments and records a mistake instead of dispatching malformed native arguments", async () => {
		const callbacks = makeCallbacks()
		const task = makeTask("read_file")
		await layeredExecuteTool.execute({ tool_id: "native:read_file", input: "{}" }, task, callbacks)

		expect(mocks.dispatchToolUse).not.toHaveBeenCalled()
		expect(callbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("invalid_arguments"))
		expect(task.consecutiveMistakeCount).toBe(1)
		expect(task.recordToolError).toHaveBeenCalledWith("execute")
		expect(task.didToolFailInCurrentTurn).toBe(true)
	})

	it("rejects malformed JSON argument strings and records a mistake", async () => {
		const callbacks = makeCallbacks()
		const task = makeTask("read_file")

		await layeredExecuteTool.execute({ tool_id: "native:read_file", input: '{"path":' }, task, callbacks)

		expect(mocks.dispatchToolUse).not.toHaveBeenCalled()
		expect(callbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining("invalid_arguments"))
		expect(task.consecutiveMistakeCount).toBe(1)
	})

	it("does not dispatch after the task is cancelled", async () => {
		const callbacks = makeCallbacks()
		const task = makeTask("read_file")
		;(task as { abort: boolean }).abort = true

		await layeredExecuteTool.execute(
			{ tool_id: "native:read_file", input: JSON.stringify({ path: "README.md" }) },
			task,
			callbacks,
		)

		expect(mocks.dispatchToolUse).not.toHaveBeenCalled()
		expect(callbacks.pushToolResult).toHaveBeenCalledWith(expect.stringContaining('"status":"cancelled"'))
	})
})
