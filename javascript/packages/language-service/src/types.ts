import type { HerbBackend } from "@herb-tools/core"
import type { ParseOptions } from "@herb-tools/core"
import type { LanguageServiceOptions as UpstreamLanguageServiceOptions } from "vscode-html-languageservice"

export interface LanguageServiceOptions extends UpstreamLanguageServiceOptions {
  herb?: HerbBackend
  herbParseOptions?: ParseOptions
  tokenListAttributes?: string[]
}
