import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Visitor } from "@herb-tools/core"

import type { HerbBackend, Node, HerbError, DocumentNode, ParseResult, ParseOptions } from "@herb-tools/core"

import { lspRangeFromLocation } from "./range_utils"

class ErrorVisitor extends Visitor {
  private readonly source = "Herb Parser "
  public diagnostics: Diagnostic[] = []

  visitChildNodes(node: Node) {
    super.visitChildNodes(node)

    node.errors.forEach(error => this.addDiagnosticForError(error, node))
  }

  private addDiagnosticForError(error: HerbError, node: Node): void {
    const diagnostic: Diagnostic = {
      source: this.source,
      severity: DiagnosticSeverity.Error,
      range: lspRangeFromLocation(error.location),
      message: error.message,
      code: error.type,
      data: {
        error: error.toJSON(),
        node: node.toJSON()
      }
    }

    this.diagnostics.push(diagnostic)
  }
}

export interface ParseServiceResult {
  document: DocumentNode
  diagnostics: Diagnostic[]
}

export class ParserService {
  private readonly backend: HerbBackend

  constructor(backend: HerbBackend) {
    this.backend = backend
  }

  parseDocument(textDocument: TextDocument): ParseServiceResult {
    const content = textDocument.getText()
    const result = this.backend.parse(content)

    const errorVisitor = new ErrorVisitor()
    result.visit(errorVisitor)

    return {
      document: result.value,
      diagnostics: errorVisitor.diagnostics
    }
  }

  parseContent(content: string, options?: ParseOptions): ParseResult {
    return this.backend.parse(content, options)
  }
}
