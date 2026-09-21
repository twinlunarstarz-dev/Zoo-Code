import { HTMLAttributes } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import type { Experiments, ImageGenerationProvider, ProviderSettingsEntry } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { ImageGenerationSettings, ImageProcessingSettings } from "./ImageGenerationSettings"
import { CustomToolsSettings } from "./CustomToolsSettings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	apiConfiguration?: any
	setApiConfigurationField?: any
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
	condensingApiConfigOverride?: boolean
	condensingApiConfigId?: string
	setCachedStateField?: SetCachedStateField<"condensingApiConfigOverride" | "condensingApiConfigId">
	setImageGenerationProvider?: (provider: ImageGenerationProvider) => void
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
	setOpenAiCompatibleImageGenerationBaseUrl?: (value: string) => void
	setOpenAiCompatibleImageGenerationApiKey?: (value: string) => void
	setOpenAiCompatibleImageGenerationModel?: (value: string) => void
	setImageProcessingEnabled?: (value: boolean) => void
	setImageProcessingApiConfigId?: (value: string) => void
	setImageProcessingPrompt?: (value: string) => void
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	apiConfiguration,
	setApiConfigurationField,
	imageGenerationProvider,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	openAiCompatibleImageGenerationBaseUrl,
	openAiCompatibleImageGenerationApiKey,
	openAiCompatibleImageGenerationModel,
	imageProcessingEnabled,
	imageProcessingApiConfigId,
	imageProcessingPrompt,
	listApiConfigMeta,
	condensingApiConfigOverride,
	condensingApiConfigId,
	setCachedStateField,
	setImageGenerationProvider,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	setOpenAiCompatibleImageGenerationBaseUrl,
	setOpenAiCompatibleImageGenerationApiKey,
	setOpenAiCompatibleImageGenerationModel,
	setImageProcessingEnabled,
	setImageProcessingApiConfigId,
	setImageProcessingPrompt,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>{t("settings:sections.experimental")}</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.filter(([, config]) => config.showInSettings !== false)
					.filter(([key]) => key !== "CHAT_HISTORY_LOOKUP")
					.map((config) => {
						// Use the same translation key pattern as ExperimentalFeature
						const experimentKey = config[0]
						const label = t(`settings:experimental.${experimentKey}.name`)

						if (
							config[0] === "IMAGE_GENERATION" &&
							setImageGenerationProvider &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel &&
							setOpenAiCompatibleImageGenerationBaseUrl &&
							setOpenAiCompatibleImageGenerationApiKey &&
							setOpenAiCompatibleImageGenerationModel &&
							setImageProcessingEnabled &&
							setImageProcessingApiConfigId &&
							setImageProcessingPrompt
						) {
							return (
								<SearchableSetting
									key={config[0]}
									settingId={`experimental-${config[0].toLowerCase()}`}
									section="experimental"
									label={label}>
									<ImageGenerationSettings
										enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
										onChange={(enabled) =>
											setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
										}
										imageGenerationProvider={imageGenerationProvider}
										openRouterImageApiKey={openRouterImageApiKey}
										openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
										setImageGenerationProvider={setImageGenerationProvider}
										setOpenRouterImageApiKey={setOpenRouterImageApiKey}
										setImageGenerationSelectedModel={setImageGenerationSelectedModel}
										openAiCompatibleImageGenerationBaseUrl={openAiCompatibleImageGenerationBaseUrl}
										openAiCompatibleImageGenerationApiKey={openAiCompatibleImageGenerationApiKey}
										openAiCompatibleImageGenerationModel={openAiCompatibleImageGenerationModel}
										imageProcessingEnabled={imageProcessingEnabled}
										imageProcessingApiConfigId={imageProcessingApiConfigId}
										imageProcessingPrompt={imageProcessingPrompt}
										listApiConfigMeta={listApiConfigMeta}
										setOpenAiCompatibleImageGenerationBaseUrl={
											setOpenAiCompatibleImageGenerationBaseUrl
										}
										setOpenAiCompatibleImageGenerationApiKey={
											setOpenAiCompatibleImageGenerationApiKey
										}
										setOpenAiCompatibleImageGenerationModel={
											setOpenAiCompatibleImageGenerationModel
										}
										setImageProcessingEnabled={setImageProcessingEnabled}
										setImageProcessingApiConfigId={setImageProcessingApiConfigId}
										setImageProcessingPrompt={setImageProcessingPrompt}
										showImageProcessingSettings={false}
									/>
								</SearchableSetting>
							)
						}
						if (config[0] === "CUSTOM_TOOLS") {
							return (
								<SearchableSetting
									key={config[0]}
									settingId={`experimental-${config[0].toLowerCase()}`}
									section="experimental"
									label={label}>
									<CustomToolsSettings
										enabled={experiments[EXPERIMENT_IDS.CUSTOM_TOOLS] ?? false}
										onChange={(enabled) =>
											setExperimentEnabled(EXPERIMENT_IDS.CUSTOM_TOOLS, enabled)
										}
									/>
								</SearchableSetting>
							)
						}
						return (
							<SearchableSetting
								key={config[0]}
								settingId={`experimental-${config[0].toLowerCase()}`}
								section="experimental"
								label={label}>
								<ExperimentalFeature
									experimentKey={config[0]}
									enabled={
										experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false
									}
									onChange={(enabled) =>
										setExperimentEnabled(
											EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
											enabled,
										)
									}
								/>
							</SearchableSetting>
						)
					})}

				<SearchableSetting
					settingId="experimental-chat-history-lookup"
					section="experimental"
					label={t("settings:experimental.CHAT_HISTORY_LOOKUP.name")}>
					<ExperimentalFeature
						experimentKey="CHAT_HISTORY_LOOKUP"
						enabled={experiments[EXPERIMENT_IDS.CHAT_HISTORY_LOOKUP] ?? false}
						onChange={(enabled) => setExperimentEnabled(EXPERIMENT_IDS.CHAT_HISTORY_LOOKUP, enabled)}
					/>
				</SearchableSetting>

				{setImageProcessingEnabled && setImageProcessingApiConfigId && setImageProcessingPrompt && (
					<SearchableSetting
						settingId="experimental-image-processing"
						section="experimental"
						label={t("settings:experimental.IMAGE_PROCESSING.name")}>
						<ImageProcessingSettings
							imageProcessingEnabled={imageProcessingEnabled}
							imageProcessingApiConfigId={imageProcessingApiConfigId}
							imageProcessingPrompt={imageProcessingPrompt}
							listApiConfigMeta={listApiConfigMeta ?? []}
							setImageProcessingEnabled={setImageProcessingEnabled}
							setImageProcessingApiConfigId={setImageProcessingApiConfigId}
							setImageProcessingPrompt={setImageProcessingPrompt}
						/>
					</SearchableSetting>
				)}

				{setCachedStateField && (
					<SearchableSetting
						settingId="experimental-context-condensing-model-override"
						section="experimental"
						label={t("settings:contextManagement.condensingApiConfiguration.label")}>
						<div>
							<VSCodeCheckbox
								checked={condensingApiConfigOverride ?? false}
								onChange={(e: any) =>
									setCachedStateField("condensingApiConfigOverride", e.target.checked)
								}
								data-testid="condensing-model-override-checkbox">
								<span className="font-medium">
									{t("settings:contextManagement.condensingApiConfiguration.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:contextManagement.condensingApiConfiguration.description")}
							</div>
							{condensingApiConfigOverride && (
								<div className="mt-3">
									<Select
										value={condensingApiConfigId || "current-mode"}
										onValueChange={(value) =>
											setCachedStateField(
												"condensingApiConfigId",
												value === "current-mode" ? "" : value,
											)
										}
										data-testid="condensing-profile-select">
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="current-mode">
												{t(
													"settings:contextManagement.condensingApiConfiguration.useCurrentConfig",
												)}
											</SelectItem>
											{(listApiConfigMeta ?? []).map((config) => (
												<SelectItem key={config.id} value={config.id}>
													{config.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>
					</SearchableSetting>
				)}
			</Section>
		</div>
	)
}
