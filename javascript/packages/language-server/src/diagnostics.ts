import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic } from "vscode-languageserver/node"

import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { DocumentService } from "./document_service"
import { ConfigService } from "./config_service"

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly parserService: ParserService
  private readonly linterService: LinterService
  private readonly configService: ConfigService
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  constructor(
    connection: Connection,
    documentService: DocumentService,
    parserService: ParserService,
    linterService: LinterService,
    configService: ConfigService,
  ) {
    this.connection = connection
    this.documentService = documentService
    this.parserService = parserService
    this.linterService = linterService
    this.configService = configService
  }

  async validate(textDocument: TextDocument) {
    let allDiagnostics: Diagnostic[] = []

    if (textDocument.uri.endsWith('.herb.yml')) {
      allDiagnostics = await this.configService.validateDocument(textDocument)
    } else {
      const parseResult = this.parserService.parseDocument(textDocument)
      const lintResult = await this.linterService.lintDocument(textDocument)

      allDiagnostics = [
        ...parseResult.diagnostics,
        ...lintResult.diagnostics,
      ]
    }

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
