const mocks = vi.hoisted(() => ({
	readHandle: vi.fn(),
	writeHandle: vi.fn(),
	attemptHandle: vi.fn(),
	newTaskHandle: vi.fn(),
	condenseHandle: vi.fn(),
	customGet: vi.fn(),
}))

vi.mock("@roo-code/core", () => ({
	customToolRegistry: { get: mocks.customGet },
}))

vi.mock("../ReadFileTool", () => ({ readFileTool: { handle: mocks.readHandle } }))
vi.mock("../WriteToFileTool", () => ({ writeToFileTool: { handle: mocks.writeHandle } }))
vi.mock("../AttemptCompletionTool", () => ({ attemptCompletionTool: { handle: mocks.attemptHandle } }))
vi.mock("../NewTaskTool", () => ({ newTaskTool: { handle: mocks.newTaskHandle } }))
vi.mock("../RequestCondenseContextTool", () => ({
	requestCondenseContextTool: { handle: mocks.condenseHandle },
}))

import type { ToolUse } from "../../../shared/tools"
import type { Task } from "../../task/Task"
import { dispatchToolUse, type DispatchToolUseOptions } from "../dispatchToolUse"

function task(): Task {
	return {
		currentStreamingDidCheckpoint: false,
		checkpointSave: vi.fn(async () => undefined),
		consecutiveMistakeCount: 0,
		recordToolError: vi.fn(),
		say: vi.fn(async () => undefined),
	} as unknown as Task
}

function block(name: string, id = "outer-call-id"): ToolUse {
	return { type: "tool_use", name, id, params: {}, nativeArgs: {}, partial: false } as ToolUse
}

function options(): DispatchToolUseOptions {
	return {
		askApproval: vi.fn(async () => true),
		handleError: vi.fn(async () => undefined),
		pushToolResult: vi.fn(),
		askFinishSubTaskApproval: vi.fn(async () => true),
		toolDescription: vi.fn(() => "tool"),
		pushUnknownToolResult: vi.fn(),
		mode: "code",
		customToolsEnabled: true,
	}
}

describe("dispatchToolUse", () => {
	beforeEach(() => vi.clearAllMocks())

	it("delegates read-only tools with the original block identity", async () => {
		const input = block("read_file")
		await dispatchToolUse(task(), input, options())
		expect(mocks.readHandle).toHaveBeenCalledWith(expect.anything(), input, expect.any(Object))
	})

	it("checkpoints writes exactly once before delegation", async () => {
		const currentTask = task()
		await dispatchToolUse(currentTask, block("write_to_file"), options())
		expect(currentTask.checkpointSave).toHaveBeenCalledOnce()
		expect(mocks.writeHandle).toHaveBeenCalledOnce()
	})

	it("preserves outer IDs for new-task delegation", async () => {
		const input = block("new_task", "provider-outer-id")
		await dispatchToolUse(task(), input, options())
		expect(mocks.newTaskHandle).toHaveBeenCalledWith(
			expect.anything(),
			input,
			expect.objectContaining({ toolCallId: "provider-outer-id" }),
		)
	})

	it("forwards completion-specific callbacks", async () => {
		const callbacks = options()
		await dispatchToolUse(task(), block("attempt_completion"), callbacks)
		expect(mocks.attemptHandle).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				askFinishSubTaskApproval: callbacks.askFinishSubTaskApproval,
				toolDescription: callbacks.toolDescription,
			}),
		)
	})

	it("delegates condensation to its existing handler", async () => {
		await dispatchToolUse(task(), block("request_condense_context"), options())
		expect(mocks.condenseHandle).toHaveBeenCalledOnce()
	})

	it("executes enabled custom tools through their current runner", async () => {
		const execute = vi.fn(async () => "custom result")
		mocks.customGet.mockReturnValue({ name: "deploy", execute })
		const callbacks = options()
		await dispatchToolUse(task(), block("deploy"), callbacks)
		expect(execute).toHaveBeenCalledWith(undefined, expect.objectContaining({ mode: "code" }))
		expect(callbacks.pushToolResult).toHaveBeenCalledWith("custom result")
	})

	it("returns unknown-tool errors through the outer result callback", async () => {
		mocks.customGet.mockReturnValue(undefined)
		const callbacks = options()
		await dispatchToolUse(task(), block("missing_tool"), callbacks)
		expect(callbacks.pushUnknownToolResult).toHaveBeenCalledOnce()
	})
})
