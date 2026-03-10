import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic } from "vscode-languageserver/node"

import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { DocumentService } from "./document_service"

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly parserService: ParserService
  private readonly linterService: LinterService
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  constructor(
    connection: Connection,
    documentService: DocumentService,
    parserService: ParserService,
    linterService: LinterService,
  ) {
    this.connection = connection
    this.documentService = documentService
    this.parserService = parserService
    this.linterService = linterService
  }

  async validate(textDocument: TextDocument) {
    const parseResult = this.parserService.parseDocument(textDocument)
    const lintResult = await this.linterService.lintDocument(textDocument)

    const allDiagnostics = [
      ...parseResult.diagnostics,
      ...lintResult.diagnostics,
    ]

    this.diagnostics.set(textDocument, allDiagnostics)
    this.sendDiagnosticsFor(textDocument)
  }

  async refreshDocument(document: TextDocument) {
    await this.validate(document)
  }

  async refreshAllDocuments() {
    const documents = this.documentService.getAll()
    await Promise.all(documents.map(document => this.refreshDocument(document)))
  }

  private sendDiagnosticsFor(textDocument: TextDocument) {
    const diagnostics = this.diagnostics.get(textDocument) || []

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })

    this.diagnostics.delete(textDocument)
  }
}
