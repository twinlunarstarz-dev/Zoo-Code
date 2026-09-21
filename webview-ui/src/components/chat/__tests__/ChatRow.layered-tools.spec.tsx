import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { ChatRowContent } from "../ChatRow"

const queryClient = new QueryClient()

function renderGateway(tool: "layeredSearch" | "layeredDocumentation" | "layeredExecute", details: string) {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={{
						type: "say",
						say: "tool",
						ts: Date.now(),
						text: JSON.stringify({ tool, details }),
					}}
					isExpanded={false}
					isLast={false}
					isStreaming={false}
					onToggleExpand={() => {}}
					onSuggestionClick={() => {}}
					onBatchFileResponse={() => {}}
					onFollowUpUnmount={() => {}}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatRow layered gateway tools", () => {
	it.each([
		["layeredSearch", "Layered search", "MCP browser"],
		["layeredDocumentation", "Layered documentation", "mcp:brave-search:brave_web_search"],
		["layeredExecute", "Layered execute", "mcp:brave-search:brave_web_search"],
	] as const)("renders %s gateway usage", (tool, title, details) => {
		renderGateway(tool, details)

		expect(screen.getByText(title)).toBeInTheDocument()
		expect(screen.getByText(details)).toBeInTheDocument()
	})

	it("keeps hook ordering stable when a row changes between gateway tool variants", () => {
		const { rerender } = renderGateway("layeredSearch", "initial details")

		rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<ChatRowContent
						message={{
							type: "say",
							say: "tool",
							ts: Date.now(),
							text: JSON.stringify({ tool: "layeredExecute", details: "updated details" }),
						}}
						isExpanded={false}
						isLast={false}
						isStreaming={false}
						onToggleExpand={() => {}}
						onSuggestionClick={() => {}}
						onBatchFileResponse={() => {}}
						onFollowUpUnmount={() => {}}
						isFollowUpAnswered={false}
					/>
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		expect(screen.getByText("Layered execute")).toBeInTheDocument()
		expect(screen.getByText("updated details")).toBeInTheDocument()
	})
})
