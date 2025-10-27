import { Diagnostic, Range, Position, CodeDescription } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter } from "@herb-tools/linter"
import { Herb } from "@herb-tools/node-wasm"

import { Settings } from "./settings"
import { lintToDignosticSeverity } from "./utils"

export interface LintServiceResult {
  diagnostics: Diagnostic[]
}

export class LinterService {
  private readonly settings: Settings
  private readonly source = "Herb Linter "
  private linter?: Linter

  constructor(settings: Settings) {
    this.settings = settings
  }

  /**
   * Rebuild the linter when config changes
   * This ensures the linter uses the latest rule configuration
   */
  rebuildLinter(): void {
    this.linter = undefined
  }

  async lintDocument(textDocument: TextDocument): Promise<LintServiceResult> {
    const settings = await this.settings.getDocumentSettings(textDocument.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return { diagnostics: [] }
    }

    const projectConfig = this.settings.projectConfig

    if (!this.linter) {
      const linterConfig = projectConfig?.config?.linter || { enabled: true, rules: {} }

      const config = {
        ...linterConfig,
        rules: {
          ...linterConfig.rules,
          'parser-no-errors': { enabled: false }
        }
      }

      this.linter = Linter.from(Herb, config)
    }

    const content = textDocument.getText()
    const lintResult = this.linter.lint(content, { fileName: textDocument.uri })

    const diagnostics: Diagnostic[] = lintResult.offenses.map(offense => {
      const range = Range.create(
        Position.create(offense.location.start.line - 1, offense.location.start.column),
        Position.create(offense.location.end.line - 1, offense.location.end.column),
      )

      const codeDescription: CodeDescription = {
        href: `https://herb-tools.dev/linter/rules/${offense.rule}`
      }

      return {
        source: this.source,
        severity: lintToDignosticSeverity(offense.severity),
        range,
        message: offense.message,
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }
    })

    return { diagnostics }
  }
}
