import { Connection, TextEdit, TextDocumentSaveReason } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "./settings"
import { Workspaces } from "./workspaces"

export class DocumentSaveService {
  private connection: Connection
  private settings: Settings
  private workspaces: Workspaces

  /**
   * Tracks documents that were recently autofixed via applyFixesAndFormatting
   * (triggered by onDocumentFormatting). When editor.formatOnSave is enabled,
   * onDocumentFormatting fires BEFORE willSaveWaitUntil. If applyFixesAndFormatting
   * already applied autofix, applyFixes must skip to avoid conflicting edits
   * (since this.documents hasn't been updated between the two events).
   */
  private recentlyAutofixedViaFormatting = new Set<string>()

  constructor(connection: Connection, settings: Settings, workspaces: Workspaces) {
    this.connection = connection
    this.settings = settings
    this.workspaces = workspaces
  }

  /**
   * Apply only autofix edits on save.
   * Called by willSaveWaitUntil - formatting is handled separately by editor.formatOnSave
   */
  async applyFixes(document: TextDocument): Promise<TextEdit[]> {
    const workspace = await this.workspaces.ensure(document.uri)

    if (!workspace) return []

    const settings = await this.settings.getDocumentSettings(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false

    this.connection.console.log(`[DocumentSave] applyFixes fixOnSave=${fixOnSave}`)

    if (!fixOnSave) return []

    if (this.recentlyAutofixedViaFormatting.delete(document.uri)) {
      this.connection.console.log(`[DocumentSave] applyFixes skipping: already autofixed via formatting`)
      return []
    }

    return workspace.autofixService.autofix(document)
  }

  /**
   * Apply autofix and formatting.
   * Called by onDocumentFormatting (manual format or editor.formatOnSave)
   */
  async applyFixesAndFormatting(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    const workspace = await this.workspaces.ensure(document.uri)

    if (!workspace) return []

    const settings = await this.settings.getDocumentSettings(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false
    const formatterEnabled = settings?.formatter?.enabled ?? false

    this.connection.console.log(`[DocumentSave] applyFixesAndFormatting fixOnSave=${fixOnSave}, formatterEnabled=${formatterEnabled}`)

    let autofixEdits: TextEdit[] = []

    if (fixOnSave) {
      autofixEdits = await workspace.autofixService.autofix(document)

      if (autofixEdits.length > 0) {
        this.recentlyAutofixedViaFormatting.add(document.uri)
      }
    }

    if (!formatterEnabled) return autofixEdits

    if (autofixEdits.length === 0) {
      return workspace.formattingService.formatOnSave(document, reason)
    }

    return workspace.formattingService.formatOnSave(document, reason, autofixEdits[0].newText)
  }
}
