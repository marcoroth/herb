import { Connection, TextEdit, TextDocumentSaveReason } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter } from "@herb-tools/linter"
import { Herb } from "@herb-tools/node-wasm"

import { Settings } from "./settings"
import { getFullDocumentRange } from "./utils"

export class AutofixService {
  private connection: Connection
  private settings: Settings
  private linter: Linter

  constructor(connection: Connection, settings: Settings) {
    this.connection = connection
    this.settings = settings
    this.linter = new Linter(Herb)
  }

  async getAutofixEdits(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    this.connection.console.log(`[Autofix] Called for ${document.uri}`)

    const settings = await this.settings.getDocumentSettings(document.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    this.connection.console.log(`[Autofix] linterEnabled=${linterEnabled}, reason=${reason}`)

    if (!linterEnabled) {
      this.connection.console.log(`[Autofix] Skipping: linter is disabled`)
      return []
    }

    if (reason !== TextDocumentSaveReason.Manual) {
      this.connection.console.log(`[Autofix] Skipping: reason=${reason} (not manual)`)
      return []
    }

    try {
      const text = document.getText()
      const excludedRules = settings?.linter?.excludedRules ?? ["parser-no-errors"]

      const lintResult = this.linter.lint(text, { fileName: document.uri })
      const offensesToFix = lintResult.offenses.filter(offense => !excludedRules.includes(offense.rule))

      this.connection.console.log(`[Autofix] Found ${offensesToFix.length} offenses to fix`)

      const autofixResult = this.linter.autofix(text, { fileName: document.uri }, offensesToFix)

      this.connection.console.log(`[Autofix] Fixed ${autofixResult.fixed.length} offenses, ${autofixResult.unfixed.length} unfixed`)

      if (autofixResult.source === text) {
        this.connection.console.log(`[Autofix] No changes made`)
        return []
      }

      this.connection.console.log(`[Autofix] Applying fixes`)

      return [{ range: getFullDocumentRange(document), newText: autofixResult.source }]
    } catch (error) {
      this.connection.console.error(`Autofix failed: ${error}`)
      return []
    }
  }
}
