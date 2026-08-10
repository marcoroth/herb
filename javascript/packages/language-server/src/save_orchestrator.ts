import { Connection, TextEdit, TextDocumentSaveReason } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Projects } from "./projects"

export class SaveOrchestrator {
  private connection: Connection
  private projects: Projects

  /**
   * Tracks documents that were recently autofixed via applyFixesAndFormatting
   * (triggered by onDocumentFormatting). When editor.formatOnSave is enabled,
   * onDocumentFormatting fires BEFORE willSaveWaitUntil. If applyFixesAndFormatting
   * already applied autofix, applyFixes must skip to avoid conflicting edits
   * (since this.documents hasn't been updated between the two events).
   */
  private recentlyAutofixedViaFormatting = new Set<string>()

  constructor(connection: Connection, projects: Projects) {
    this.connection = connection
    this.projects = projects
  }

  /**
   * A closed document can't be mid-save, so anything remembered about its last
   * save would only be able to suppress a later, unrelated autofix.
   */
  forget(uri: string) {
    this.recentlyAutofixedViaFormatting.delete(uri)
  }

  /**
   * Apply only autofix edits on save.
   * Called by willSaveWaitUntil - formatting is handled separately by editor.formatOnSave
   */
  async applyFixes(document: TextDocument): Promise<TextEdit[]> {
    const project = await this.projects.ensure(document.uri)

    if (!project) return []

    const settings = await project.settingsFor(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false

    this.connection.console.log(`[DocumentSave] applyFixes fixOnSave=${fixOnSave}`)

    if (!fixOnSave) return []

    if (this.recentlyAutofixedViaFormatting.delete(document.uri)) {
      this.connection.console.log(`[DocumentSave] applyFixes skipping: already autofixed via formatting`)
      return []
    }

    return project.autofixService.autofix(document)
  }

  /**
   * Apply autofix and formatting.
   * Called by onDocumentFormatting (manual format or editor.formatOnSave)
   */
  async applyFixesAndFormatting(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    const project = await this.projects.ensure(document.uri)

    if (!project) return []

    const settings = await project.settingsFor(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false
    const formatterEnabled = settings?.formatter?.enabled ?? false

    this.connection.console.log(`[DocumentSave] applyFixesAndFormatting fixOnSave=${fixOnSave}, formatterEnabled=${formatterEnabled}`)

    let autofixEdits: TextEdit[] = []

    if (fixOnSave) {
      autofixEdits = await project.autofixService.autofix(document)

      if (autofixEdits.length > 0) {
        this.recentlyAutofixedViaFormatting.add(document.uri)
      }
    }

    if (!formatterEnabled) return autofixEdits

    if (autofixEdits.length === 0) {
      return project.formattingProvider.formatOnSave(document, reason)
    }

    return project.formattingProvider.formatOnSave(document, reason, autofixEdits[0].newText)
  }
}
