import { TextDocument } from "vscode-languageserver-textdocument"
import { CodeAction, CodeActionKind, CodeActionParams, Range, Position, WorkspaceEdit } from "vscode-languageserver/node"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"

import { Settings } from "./settings"
import { getFullDocumentRange } from "./utils"

import type { LintOffense } from "@herb-tools/linter"

export class CodeActionService {
  private settings: Settings
  private linter: Linter

  constructor(settings: Settings) {
    this.settings = settings
    this.linter = new Linter(Herb)
  }

  async getCodeActions(params: CodeActionParams, document: TextDocument): Promise<CodeAction[]> {
    const settings = await this.settings.getDocumentSettings(document.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return []
    }

    const codeActions: CodeAction[] = []
    const text = document.getText()
    const excludedRules = settings?.linter?.excludedRules ?? ["parser-no-errors"]

    const lintResult = this.linter.lint(text, { fileName: document.uri })
    const offenses = lintResult.offenses.filter(offense => !excludedRules.includes(offense.rule))

    const relevantDiagnostics = params.context.diagnostics.filter(diagnostic => {
      return diagnostic.source === "Herb Linter " && this.isInRange(diagnostic.range, params.range)
    })

    for (const diagnostic of relevantDiagnostics) {
      const offense = offenses.find(offense => this.rangesEqual(this.offenseToRange(offense), diagnostic.range) && offense.rule === diagnostic.code)

      if (!offense) {
        continue
      }

      const fixResult = this.linter.autofix(text, { fileName: document.uri }, [offense])

      if (fixResult.fixed.length > 0 && fixResult.source !== text) {
        const codeAction: CodeAction = {
          title: `Herb Linter: Fix "${offense.message}"`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: this.createDocumentEdit(document, fixResult.source)
        }

        codeActions.push(codeAction)
      }
    }

    const allFixableOffenses = offenses.filter(offense => {
      const fixResult = this.linter.autofix(text, { fileName: document.uri }, [offense])

      return fixResult.fixed.length > 0
    })

    if (allFixableOffenses.length > 1) {
      const fixAllResult = this.linter.autofix(text, { fileName: document.uri }, allFixableOffenses)

      if (fixAllResult.fixed.length > 0 && fixAllResult.source !== text) {
        const fixAllAction: CodeAction = {
          title: `Herb Linter: Fix all ${fixAllResult.fixed.length} autocorrectable linter offenses`,
          kind: CodeActionKind.SourceFixAll,
          edit: this.createDocumentEdit(document, fixAllResult.source)
        }

        codeActions.push(fixAllAction)
      }
    }

    return codeActions
  }

  private createDocumentEdit(document: TextDocument, newText: string): WorkspaceEdit {
    return {
      changes: {
        [document.uri]: [{
          range: getFullDocumentRange(document),
          newText
        }]
      }
    }
  }

  private offenseToRange(offense: LintOffense): Range {
    return {
      start: Position.create(offense.location.start.line - 1, offense.location.start.column),
      end: Position.create(offense.location.end.line - 1, offense.location.end.column)
    }
  }

  private rangesEqual(r1: Range, r2: Range): boolean {
    return (
      r1.start.line === r2.start.line &&
      r1.start.character === r2.start.character &&
      r1.end.line === r2.end.line &&
      r1.end.character === r2.end.character
    )
  }

  private isInRange(diagnosticRange: Range, requestedRange: Range): boolean {
    if (diagnosticRange.start.line > requestedRange.end.line) return false
    if (diagnosticRange.end.line < requestedRange.start.line) return false

    return true
  }
}
