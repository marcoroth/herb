import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic, DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"
import { Visitor } from "@herb-tools/core"

import type {
  Node,
  ERBCaseNode,
  ERBCaseMatchNode,
  HTMLTextNode,
} from "@herb-tools/core"

import { isHTMLTextNode } from "@herb-tools/core"

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
      const unreachableCodeDiagnostics = this.getUnreachableCodeDiagnostics(parseResult.document)

      allDiagnostics = [
        ...parseResult.diagnostics,
        ...lintResult.diagnostics,
        ...unreachableCodeDiagnostics,
      ]
    }

    this.diagnostics.set(textDocument, allDiagnostics)
    this.sendDiagnosticsFor(textDocument)
  }

  private getUnreachableCodeDiagnostics(document: Node): Diagnostic[] {
    const collector = new UnreachableCodeCollector()
    collector.visit(document)
    return collector.diagnostics
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

export class UnreachableCodeCollector extends Visitor {
  diagnostics: Diagnostic[] = []

  visitERBCaseNode(node: ERBCaseNode): void {
    this.checkUnreachableChildren(node.children)
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.checkUnreachableChildren(node.children)
    this.visitChildNodes(node)
  }

  private checkUnreachableChildren(children: Node[]): void {
    for (const child of children) {
      if (isHTMLTextNode(child) && child.content.trim() === "") {
        continue
      }

      const diagnostic: Diagnostic = {
        range: {
          start: {
            line: this.toZeroBased(child.location.start.line),
            character: child.location.start.column
          },
          end: {
            line: this.toZeroBased(child.location.end.line),
            character: child.location.end.column
          }
        },
        message: "Unreachable code: content between case and when/in is never executed",
        severity: DiagnosticSeverity.Hint,
        tags: [DiagnosticTag.Unnecessary],
        source: "Herb Language Server"
      }

      this.diagnostics.push(diagnostic)
    }
  }

  private toZeroBased(line: number): number {
    return line - 1
  }
}
