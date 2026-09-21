import React, { useMemo } from "react"
import {
	VSCodeCheckbox,
	VSCodeTextArea,
	VSCodeTextField,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react"
import {
	IMAGE_GENERATION_MODELS,
	type ImageGenerationProvider,
	type ProviderSettingsEntry,
	getImageGenerationProvider,
} from "@roo-code/types"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface ImageGenerationSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	imageGenerationProvider?: ImageGenerationProvider
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	openAiCompatibleImageGenerationBaseUrl?: string
	openAiCompatibleImageGenerationApiKey?: string
	openAiCompatibleImageGenerationModel?: string
	imageProcessingEnabled?: boolean
	imageProcessingApiConfigId?: string
	imageProcessingPrompt?: string
	listApiConfigMeta?: ProviderSettingsEntry[]
	setImageGenerationProvider: (provider: ImageGenerationProvider) => void
	setOpenRouterImageApiKey: (apiKey: string) => void
	setImageGenerationSelectedModel: (model: string) => void
	setOpenAiCompatibleImageGenerationBaseUrl: (value: string) => void
	setOpenAiCompatibleImageGenerationApiKey: (value: string) => void
	setOpenAiCompatibleImageGenerationModel: (value: string) => void
	setImageProcessingEnabled: (value: boolean) => void
	setImageProcessingApiConfigId: (value: string) => void
	setImageProcessingPrompt: (value: string) => void
	showImageProcessingSettings?: boolean
}

const DEFAULT_IMAGE_DESCRIPTION_PROMPT =
	"Describe this image in exhaustive, precise detail. Include all visible text, objects, layout, relationships, colors, context, and relevant visual details so your description can answer any possible question about the image."

export const ImageGenerationSettings = ({
	enabled,
	onChange,
	imageGenerationProvider,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	openAiCompatibleImageGenerationBaseUrl,
	openAiCompatibleImageGenerationApiKey,
	openAiCompatibleImageGenerationModel,
	imageProcessingEnabled,
	imageProcessingApiConfigId,
	imageProcessingPrompt,
	listApiConfigMeta = [],
	setImageGenerationProvider,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	setOpenAiCompatibleImageGenerationBaseUrl,
	setOpenAiCompatibleImageGenerationApiKey,
	setOpenAiCompatibleImageGenerationModel,
	setImageProcessingEnabled,
	setImageProcessingApiConfigId,
	setImageProcessingPrompt,
	showImageProcessingSettings = true,
}: ImageGenerationSettingsProps) => {
	const { t } = useAppTranslation()
	const currentProvider = getImageGenerationProvider(
		imageGenerationProvider,
		!!openRouterImageGenerationSelectedModel,
	)
	const availableModels = useMemo(
		() => IMAGE_GENERATION_MODELS.filter((model) => model.provider === currentProvider),
		[currentProvider],
	)
	const currentModel =
		openRouterImageGenerationSelectedModel &&
		availableModels.some((model) => model.value === openRouterImageGenerationSelectedModel)
			? openRouterImageGenerationSelectedModel
			: (availableModels[0]?.value ?? "")

	const isOpenAiCompatible = currentProvider === "openai-compatible"
	const isConfigured = isOpenAiCompatible
		? !!(
				openAiCompatibleImageGenerationBaseUrl &&
				openAiCompatibleImageGenerationApiKey &&
				openAiCompatibleImageGenerationModel
			)
		: !!openRouterImageApiKey

	return (
		<div className="space-y-4">
			<div>
				<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
					<span className="font-medium">{t("settings:experimental.IMAGE_GENERATION.name")}</span>
				</VSCodeCheckbox>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.IMAGE_GENERATION.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_GENERATION.providerLabel")}
						</label>
						<VSCodeDropdown
							value={currentProvider}
							onChange={(e: any) => setImageGenerationProvider(e.target.value as ImageGenerationProvider)}
							className="w-full">
							<VSCodeOption value="openrouter">OpenRouter</VSCodeOption>
							<VSCodeOption value="openai-compatible">OpenAI Compatible</VSCodeOption>
						</VSCodeDropdown>
					</div>

					{isOpenAiCompatible ? (
						<>
							<div>
								<label className="block font-medium mb-1">OpenAI-compatible base URL</label>
								<VSCodeTextField
									value={openAiCompatibleImageGenerationBaseUrl ?? ""}
									onInput={(e: any) => setOpenAiCompatibleImageGenerationBaseUrl(e.target.value)}
									placeholder="https://api.example.com/v1"
									className="w-full"
								/>
							</div>
							<div>
								<label className="block font-medium mb-1">API key</label>
								<VSCodeTextField
									value={openAiCompatibleImageGenerationApiKey ?? ""}
									onInput={(e: any) => setOpenAiCompatibleImageGenerationApiKey(e.target.value)}
									type="password"
									className="w-full"
								/>
							</div>
							<div>
								<label className="block font-medium mb-1">Image generation model</label>
								<VSCodeTextField
									value={openAiCompatibleImageGenerationModel ?? ""}
									onInput={(e: any) => setOpenAiCompatibleImageGenerationModel(e.target.value)}
									placeholder="gpt-image-1"
									className="w-full"
								/>
							</div>
						</>
					) : (
						<>
							<div>
								<label className="block font-medium mb-1">
									{t("settings:experimental.IMAGE_GENERATION.openRouterApiKeyLabel")}
								</label>
								<VSCodeTextField
									value={openRouterImageApiKey ?? ""}
									onInput={(e: any) => setOpenRouterImageApiKey(e.target.value)}
									placeholder={t(
										"settings:experimental.IMAGE_GENERATION.openRouterApiKeyPlaceholder",
									)}
									type="password"
									className="w-full"
								/>
							</div>
							<div>
								<label className="block font-medium mb-1">
									{t("settings:experimental.IMAGE_GENERATION.modelSelectionLabel")}
								</label>
								<VSCodeDropdown
									value={currentModel}
									onChange={(e: any) => setImageGenerationSelectedModel(e.target.value)}
									className="w-full">
									{availableModels.map((model) => (
										<VSCodeOption key={model.value} value={model.value}>
											{model.label}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
							</div>
						</>
					)}

					<div className="p-2 bg-vscode-editorInfo-background text-vscode-editorInfo-foreground rounded text-sm">
						{isConfigured
							? t("settings:experimental.IMAGE_GENERATION.successConfigured")
							: t("settings:experimental.IMAGE_GENERATION.warningMissingKey")}
					</div>
				</div>
			)}

			{showImageProcessingSettings && (
				<ImageProcessingSettings
					imageProcessingEnabled={imageProcessingEnabled}
					imageProcessingApiConfigId={imageProcessingApiConfigId}
					imageProcessingPrompt={imageProcessingPrompt}
					listApiConfigMeta={listApiConfigMeta}
					setImageProcessingEnabled={setImageProcessingEnabled}
					setImageProcessingApiConfigId={setImageProcessingApiConfigId}
					setImageProcessingPrompt={setImageProcessingPrompt}
				/>
			)}
		</div>
	)
}

export interface ImageProcessingSettingsProps {
	imageProcessingEnabled?: boolean
	imageProcessingApiConfigId?: string
	imageProcessingPrompt?: string
	listApiConfigMeta: ProviderSettingsEntry[]
	setImageProcessingEnabled: (value: boolean) => void
	setImageProcessingApiConfigId: (value: string) => void
	setImageProcessingPrompt: (value: string) => void
}

export const ImageProcessingSettings = ({
	imageProcessingEnabled,
	imageProcessingApiConfigId,
	imageProcessingPrompt,
	listApiConfigMeta,
	setImageProcessingEnabled,
	setImageProcessingApiConfigId,
	setImageProcessingPrompt,
}: ImageProcessingSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="border-t border-vscode-widget-border pt-4">
			<VSCodeCheckbox
				checked={imageProcessingEnabled ?? false}
				onChange={(e: any) => setImageProcessingEnabled(e.target.checked)}>
				<span className="font-medium">{t("settings:experimental.IMAGE_PROCESSING.name")}</span>
			</VSCodeCheckbox>
			<p className="text-vscode-descriptionForeground text-sm mt-1">
				{t("settings:experimental.IMAGE_PROCESSING.description")}
			</p>
			{imageProcessingEnabled && (
				<div className="ml-2 mt-3 space-y-3">
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_PROCESSING.providerProfile")}
						</label>
						<VSCodeDropdown
							value={imageProcessingApiConfigId ?? ""}
							onChange={(e: any) => setImageProcessingApiConfigId(e.target.value)}
							className="w-full">
							<VSCodeOption value="">
								{t("settings:experimental.IMAGE_PROCESSING.selectProvider")}
							</VSCodeOption>
							{listApiConfigMeta.map((profile) => (
								<VSCodeOption key={profile.id} value={profile.id}>
									{profile.name}
									{profile.modelId ? ` (${profile.modelId})` : ""}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_PROCESSING.prompt")}
						</label>
						<VSCodeTextArea
							value={imageProcessingPrompt ?? ""}
							onInput={(e: any) => setImageProcessingPrompt(e.target.value)}
							placeholder={DEFAULT_IMAGE_DESCRIPTION_PROMPT}
							className="w-full"
							rows={5}
						/>
						<p className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:experimental.IMAGE_PROCESSING.promptHint")}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
