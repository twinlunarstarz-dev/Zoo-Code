import { fireEvent, render, screen } from "@testing-library/react"

import { experimentDefault } from "@roo/experiments"

import { ExperimentalSettings } from "../ExperimentalSettings"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ExperimentalSettings", () => {
	const defaultProps = {
		experiments: experimentDefault,
		setExperimentEnabled: vi.fn(),
		setImageGenerationProvider: vi.fn(),
		setOpenRouterImageApiKey: vi.fn(),
		setImageGenerationSelectedModel: vi.fn(),
		setOpenAiCompatibleImageGenerationBaseUrl: vi.fn(),
		setOpenAiCompatibleImageGenerationApiKey: vi.fn(),
		setOpenAiCompatibleImageGenerationModel: vi.fn(),
		setImageProcessingEnabled: vi.fn(),
		setImageProcessingApiConfigId: vi.fn(),
		setImageProcessingPrompt: vi.fn(),
		setCachedStateField: vi.fn(),
		listApiConfigMeta: [],
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("does not render internal-only experiment flags", () => {
		render(<ExperimentalSettings {...defaultProps} />)

		expect(screen.getByText("settings:experimental.PREVENT_FOCUS_DISRUPTION.name")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.RUN_SLASH_COMMAND.name")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.IMAGE_GENERATION.name")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.CUSTOM_TOOLS.name")).toBeInTheDocument()
		expect(screen.queryByText("settings:experimental.PARALLEL_TOOL_EXECUTION.name")).not.toBeInTheDocument()
	})

	it("renders chat history, image processing, and condensing settings at the bottom", () => {
		render(<ExperimentalSettings {...defaultProps} />)

		const history = screen.getByText("settings:experimental.CHAT_HISTORY_LOOKUP.name")
		const imageProcessing = screen.getByText("settings:experimental.IMAGE_PROCESSING.name")
		const condensing = screen.getByText("settings:contextManagement.condensingApiConfiguration.label")

		expect(history.compareDocumentPosition(imageProcessing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(imageProcessing.compareDocumentPosition(condensing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it("updates the image processing setting through the cached-state setter", () => {
		render(<ExperimentalSettings {...defaultProps} />)

		fireEvent.click(screen.getByText("settings:experimental.IMAGE_PROCESSING.name").closest("label")!)

		expect(defaultProps.setImageProcessingEnabled).toHaveBeenCalledWith(true)
	})
})
