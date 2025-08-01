import { Diagnostic, DiagnosticSeverity, Range, Position, CodeDescription } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Linter } from "@herb-tools/linter"
import { Herb } from "@herb-tools/node-wasm"

import { Settings } from "./settings"

import type { DocumentNode } from "@herb-tools/node-wasm"

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

  async lintDocument(document: DocumentNode, textDocument: TextDocument): Promise<LintServiceResult> {
    const settings = await this.settings.getDocumentSettings(textDocument.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return { diagnostics: [] }
    }

    const lintResult = this.linter.lint(textDocument.getText())
    const diagnostics: Diagnostic[] = []

    lintResult.offenses.forEach(offense => {
      const severity = offense.severity === "error"
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning

      const range = Range.create(
        Position.create(offense.location.start.line - 1, offense.location.start.column),
        Position.create(offense.location.end.line - 1, offense.location.end.column),
      )

      const codeDescription: CodeDescription = {
        href: `https://herb-tools.dev/linter/rules/${offense.rule}`
      }

      const diagnostic: Diagnostic = {
        source: this.source,
        severity,
        range,
        message: offense.message,
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }

      diagnostics.push(diagnostic)
    })

    return { diagnostics }
  }
}
