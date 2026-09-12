import type { HerbBackend } from "@herb-tools/core"
import type { ParseOptions } from "@herb-tools/core"
import type { LanguageServiceOptions as UpstreamLanguageServiceOptions } from "vscode-html-languageservice"
import type { Config, Framework } from "@herb-tools/config"

export type ProjectConfig = {
  framework?: Config["framework"]
  parserOptions?: Config["parserOptions"]
}

export interface FrameworkOptions {
  framework?: Framework
}

export interface LanguageServiceOptions extends UpstreamLanguageServiceOptions {
  herb?: HerbBackend
  herbParseOptions?: ParseOptions
  tokenListAttributes?: string[]
  framework?: Framework
}
