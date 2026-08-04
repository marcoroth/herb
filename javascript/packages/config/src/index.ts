export { Config, resolveSeverity, ALL_RULES_KEY } from "./config.js"
export { HerbConfigSchema } from "./config-schema.js"
export { addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "./vscode.js"

export type {
  HerbConfig,
  HerbConfigOptions,
  LinterConfig,
  FormatterConfig,
  EngineConfig,
  RuleConfig,
  FilesConfig,
  LoadOptions,
  FromObjectOptions,
  ConfigValidationError,
  SeverityConfig,
  LinterMode
} from "./config.js"

export type { VSCodeExtensionsJson } from "./vscode.js"
