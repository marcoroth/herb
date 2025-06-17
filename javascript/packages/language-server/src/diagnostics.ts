import { Connection, Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb, Visitor } from "@herb-tools/node-wasm"

import { DocumentService } from "./document_service"

import type { Node, HerbError } from "@herb-tools/node-wasm"

class ErrorVisitor extends Visitor {
  private diagnostics: Diagnostics
  private textDocument: TextDocument

  constructor(diagnostics: Diagnostics, textDocument: TextDocument) {
    super()
    this.diagnostics = diagnostics
    this.textDocument = textDocument
  }

  visitChildNodes(node: Node) {
    super.visitChildNodes(node)

    node.errors.forEach(error => this.publishDiagnosticForError(error, node))
  }

  private publishDiagnosticForError(error: HerbError, node: Node): void {
    this.diagnostics.pushDiagnostic(
      error.message,
      error.type,
      this.rangeFromHerbError(error),
      this.textDocument,
      {
        error: error.toJSON(),
        node: node.toJSON()
      },
      DiagnosticSeverity.Error
    )
  }

  private rangeFromHerbError(error: HerbError): Range {
    return Range.create(
      Position.create(error.location.start.line, error.location.start.column),
      Position.create(error.location.end.line, error.location.end.column),
    )
  }
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly diagnosticsSource = "Herb LSP "
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  constructor(
    connection: Connection,
    documentService: DocumentService,
  ) {
    this.connection = connection
    this.documentService = documentService
  }

  validate(textDocument: TextDocument) {
    const content = textDocument.getText()
    const result = Herb.parse(content)
    const visitor = new ErrorVisitor(this, textDocument)

    result.visit(visitor)

    this.sendDiagnosticsFor(textDocument)
  }

  refreshDocument(document: TextDocument) {
    this.validate(document)
  }

  refreshAllDocuments() {
    this.documentService.getAll().forEach((document) => {
      this.refreshDocument(document)
    })
  }

  pushDiagnostic(
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {
    const diagnostic: Diagnostic = {
      source: this.diagnosticsSource,
      severity,
      range,
      message,
      code,
      data,
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)

    return diagnostic
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
