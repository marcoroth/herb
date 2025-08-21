import { Diagnostic, DiagnosticSeverity, Range, Position, CodeDescription } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter } from "@herb-tools/linter"
import { Herb } from "@herb-tools/node-wasm"

import { Settings } from "./settings"

import type { LintSeverity  } from "@herb-tools/linter"

export interface LintServiceResult {
  diagnostics: Diagnostic[]
}

export class LinterService {
  private readonly settings: Settings
  private readonly source = "Herb Linter "
  private linter: Linter

  constructor(settings: Settings) {
    this.settings = settings
    this.linter = new Linter(Herb)
  }

  async lintDocument(textDocument: TextDocument): Promise<LintServiceResult> {
    const settings = await this.settings.getDocumentSettings(textDocument.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return { diagnostics: [] }
    }

    const lintResult = this.linter.lint(textDocument.getText(), { fileName: textDocument.uri })
    const excludedRules = settings?.linter?.excludedRules ?? ["parser-no-errors"]
    const offenses = lintResult.offenses.filter(offense => !excludedRules.includes(offense.rule))

    const diagnostics: Diagnostic[] = offenses.map(offense => {
      const range = Range.create(
        Position.create(offense.location.start.line - 1, offense.location.start.column),
        Position.create(offense.location.end.line - 1, offense.location.end.column),
      )

      const codeDescription: CodeDescription = {
        href: `https://herb-tools.dev/linter/rules/${offense.rule}`
      }

      return {
        source: this.source,
        severity: this.lintToDignosticSeverity(offense.severity),
        range,
        message: offense.message,
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }
    })

    return { diagnostics }
  }

  private lintToDignosticSeverity(severity: LintSeverity): DiagnosticSeverity {
    switch (severity) {
      case "error": return DiagnosticSeverity.Error
      case "warning": return DiagnosticSeverity.Warning
      case "info": return DiagnosticSeverity.Information
      case "hint": return DiagnosticSeverity.Hint
    }
  }
}
