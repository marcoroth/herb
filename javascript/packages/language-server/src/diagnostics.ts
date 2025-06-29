import { Connection, Diagnostic, DiagnosticSeverity, Range, Position, CodeDescription } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb, Visitor } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"

import { DocumentService } from "./document_service"

import type { Node, HerbError, DocumentNode } from "@herb-tools/node-wasm"

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
    this.diagnostics.pushDiagnosticForParser(
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
      Position.create(error.location.start.line - 1, error.location.start.column),
      Position.create(error.location.end.line - 1, error.location.end.column),
    )
  }
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly parserDiagnosticsSource = "Herb Parser "
  private readonly linterDiagnosticsSource = "Herb Linter "
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

    const errorVisitor = new ErrorVisitor(this, textDocument)
    result.visit(errorVisitor)

    this.runLinter(result.value, textDocument)

    this.sendDiagnosticsFor(textDocument)
  }

  private runLinter(document: DocumentNode, textDocument: TextDocument) {
    const linter = new Linter()
    const lintResult = linter.lint(document)

    lintResult.messages.forEach(message => {
      const severity = message.severity === "error"
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning

      const range = Range.create(
        Position.create(message.location.start.line - 1, message.location.start.column),
        Position.create(message.location.end.line - 1, message.location.end.column),
      )

      this.pushDiagnosticForLinter(
        message.message,
        message.rule,
        range,
        textDocument,
        { rule: message.rule },
        severity
      )
    })
  }

  refreshDocument(document: TextDocument) {
    this.validate(document)
  }

  refreshAllDocuments() {
    this.documentService.getAll().forEach((document) => {
      this.refreshDocument(document)
    })
  }

  pushDiagnosticForParser(
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {
    return this.pushDiagnostic(this.parserDiagnosticsSource, message, code, range, textDocument, data, severity)
  }

  pushDiagnosticForLinter(
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {
    const codeDescription: CodeDescription = {
      href: `https://github.com/marcoroth/herb/blob/main/javascript/packages/linter/docs/rules/${code}.md`
    }
    return this.pushDiagnostic(this.linterDiagnosticsSource, message, code, range, textDocument, data, severity, codeDescription)
  }

  private pushDiagnostic(
    source: string,
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    codeDescription?: CodeDescription,
  ) {
    const diagnostic: Diagnostic = {
      source,
      severity,
      range,
      message,
      code,
      data,
      ...(codeDescription && { codeDescription }),
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
