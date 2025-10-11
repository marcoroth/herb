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

  constructor(connection: Connection, settings: Settings, autofixService: AutofixService, formattingService: FormattingService) {
    this.connection = connection
    this.settings = settings
    this.autofixService = autofixService
    this.formattingService = formattingService
  }

  async applyFixesAndFormatting(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    const settings = await this.settings.getDocumentSettings(document.uri)
    const fixOnSave = settings?.linter?.fixOnSave !== false
    const formatterEnabled = settings?.formatter?.enabled ?? false

    this.connection.console.log(`[DocumentSave] fixOnSave=${fixOnSave}, formatterEnabled=${formatterEnabled}`)

    let autofixEdits: TextEdit[] = []

    if (fixOnSave) {
      autofixEdits = await this.autofixService.autofix(document)
    }

    if (!formatterEnabled) return autofixEdits

    if (autofixEdits.length === 0) {
      return this.formattingService.formatOnSave(document, reason)
    }

    const autofixedDocument: TextDocument = {
      ...document,
      uri: document.uri,
      getText: () => autofixEdits[0].newText,
    }

    return this.formattingService.formatOnSave(autofixedDocument, reason)
  }
}
