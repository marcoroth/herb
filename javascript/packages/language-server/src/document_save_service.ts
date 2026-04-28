import { Connection, TextEdit, TextDocumentSaveReason } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "./settings"
import { AutofixService } from "./autofix_service"
import { FormattingService } from "./formatting_service"

export class DocumentSaveService {
  private connection: Connection
  private settings: Settings
  private autofixService: AutofixService
  private formattingService: FormattingService

  /**
   * Tracks documents that were recently autofixed via applyFixesAndFormatting
   * (triggered by onDocumentFormatting). When editor.formatOnSave is enabled,
   * onDocumentFormatting fires BEFORE willSaveWaitUntil. If applyFixesAndFormatting
   * already applied autofix, applyFixes must skip to avoid conflicting edits
   * (since this.documents hasn't been updated between the two events).
   */
  private recentlyAutofixedViaFormatting = new Set<string>()

  constructor(connection: Connection, settings: Settings, autofixService: AutofixService, formattingService: FormattingService) {
    this.connection = connection
    this.settings = settings
    this.autofixService = autofixService
    this.formattingService = formattingService
  }

  /**
   * Apply only autofix edits on save.
   * Called by willSaveWaitUntil - formatting is handled separately by editor.formatOnSave
   */
  async applyFixes(document: TextDocument): Promise<TextEdit[]> {
    const settings = await this.settings.getDocumentSettings(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false

    this.connection.console.log(`[DocumentSave] applyFixes fixOnSave=${fixOnSave}`)

    if (!fixOnSave) return []

    if (this.recentlyAutofixedViaFormatting.delete(document.uri)) {
      this.connection.console.log(`[DocumentSave] applyFixes skipping: already autofixed via formatting`)
      return []
    }

    return this.autofixService.autofix(document)
  }

  /**
   * Apply autofix and formatting.
   * Called by onDocumentFormatting (manual format or editor.formatOnSave)
   */
  async applyFixesAndFormatting(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    const settings = await this.settings.getDocumentSettings(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false
    const formatterEnabled = settings?.formatter?.enabled ?? false

    this.connection.console.log(`[DocumentSave] applyFixesAndFormatting fixOnSave=${fixOnSave}, formatterEnabled=${formatterEnabled}`)

    let autofixEdits: TextEdit[] = []

    if (fixOnSave) {
      autofixEdits = await this.autofixService.autofix(document)

      if (autofixEdits.length > 0) {
        this.recentlyAutofixedViaFormatting.add(document.uri)
      }
    }

    if (!formatterEnabled) return autofixEdits

    if (autofixEdits.length === 0) {
      return this.formattingService.formatOnSave(document, reason)
    }

    return this.formattingService.formatOnSave(document, reason, autofixEdits[0].newText)
  }
}
