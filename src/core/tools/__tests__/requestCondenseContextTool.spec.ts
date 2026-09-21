import type { Task } from "../../task/Task"
import type { ToolUse } from "../../../shared/tools"
import type { ToolCallbacks } from "../BaseTool"
import { requestCondenseContextTool } from "../RequestCondenseContextTool"

describe("RequestCondenseContextTool", () => {
	let task: Task
	let callbacks: ToolCallbacks
	let events: string[]

	beforeEach(() => {
		events = []
		task = {
			consecutiveMistakeCount: 3,
			condenseContext: vi.fn(async () => {
				events.push("condense")
			}),
			say: vi.fn().mockResolvedValue(undefined),
		} as unknown as Task
		callbacks = {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: vi.fn(),
			pushToolResult: vi.fn(() => {
				events.push("result")
			}),
		}
	})

	const block: ToolUse<"request_condense_context"> = {
		type: "tool_use",
		id: "toolu_condense_1",
		name: "request_condense_context",
		params: {},
		partial: false,
		nativeArgs: {},
	}

	it("emits the tool result before condensing without requesting approval", async () => {
		await requestCondenseContextTool.handle(task, block, callbacks)

		expect(callbacks.askApproval).not.toHaveBeenCalled()
		expect(events).toEqual(["result", "condense"])
		expect(task.condenseContext).toHaveBeenCalledTimes(1)
		expect(task.consecutiveMistakeCount).toBe(0)
	})

	it("reports a late condensation failure without emitting a duplicate tool result", async () => {
		const error = new Error("summary unavailable")
		vi.mocked(task.condenseContext).mockRejectedValue(error)

		await requestCondenseContextTool.handle(task, block, callbacks)

		expect(callbacks.pushToolResult).toHaveBeenCalledTimes(1)
		expect(callbacks.handleError).not.toHaveBeenCalled()
		expect(task.say).toHaveBeenCalledWith("error", "Error condensing context: summary unavailable")
	})
})
