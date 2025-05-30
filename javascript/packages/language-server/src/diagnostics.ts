import { Connection, Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { getLanguageService, Node } from "vscode-html-languageservice"

import { DocumentService } from "./document_service"
import type { Service } from "./service"
import type { SourceFile } from "./source_file"
import type { Project } from "./project"

import { Herb } from "@herb-tools/node"

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly project: Project
  private readonly service: Service
  private readonly diagnosticsSource = "Herb LSP "
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  controllerAttribute = "data-controller"
  actionAttribute = "data-action"
  targetAttribute = /data-(.+)-target/
  valueAttribute = /data-(.+)-(.+)-value/

  constructor(
    connection: Connection,
    documentService: DocumentService,
    project: Project,
    service: Service,
  ) {
    this.connection = connection
    this.documentService = documentService
    this.project = project
    this.service = service
  }

  populateSourceFileErrorsAsDiagnostics(sourceFile: SourceFile, textDocument: TextDocument) {
    sourceFile.errors.map((error) => {
      const range: Range = {
        start: {
          line: 1,
          character: 1
        },
        end: {
          line: 1,
          character: 1
        }
      }

      this.pushDiagnostic(
        error.message,
        "herb.source_file.error",
        range,
        textDocument,
        {},
        DiagnosticSeverity.Warning,
      )
    })
  }

  visitNode(node: Node, textDocument: TextDocument) {
    node.children.forEach((child) => {
      this.visitNode(child, textDocument)
    })
  }

  validate(textDocument: TextDocument) {
    if (["javascript", "typescript"].includes(textDocument.languageId)) {
      this.validateJavaScriptDocument(textDocument)
    } else {
      this.validateHTMLDocument(textDocument)
    }

    this.sendDiagnosticsFor(textDocument)
  }

  validateJavaScriptDocument(textDocument: TextDocument) {
    const sourceFiles: SourceFile[] = []
    const sourceFile = sourceFiles.find((file) => `file://${file.path}` === textDocument.uri)

    if (sourceFile) {
      this.populateSourceFileErrorsAsDiagnostics(sourceFile, textDocument)
    }
  }

  validateHTMLDocument(textDocument: TextDocument) {
    const content = textDocument.getText()
    const result = Herb.parse(content)

    console.error(result.inspect())

    const service = getLanguageService()
    const html = service.parseHTMLDocument(textDocument)

    html.roots.forEach((node: Node) => {
      this.visitNode(node, textDocument)
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

  private rangeFromNode(textDocument: TextDocument, node: Node) {
    return Range.create(textDocument.positionAt(node.start), textDocument.positionAt(node.startTagEnd || node.end))
  }

  private createParseErrorDiagnosticFor(identifier: string, error: string, textDocument: TextDocument, range: Range) {
    this.pushDiagnostic(
      `There was an error parsing the "${identifier}" Herb controller. \nPlease check the controller for the following error: ${error}`,
      "herb.controller.parse_error",
      range,
      textDocument,
      { identifier },
    )
  }

  private pushDiagnostic(
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
