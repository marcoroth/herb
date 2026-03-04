import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb, Visitor } from "@herb-tools/node-wasm"

import type { Node, HerbError, DocumentNode } from "@herb-tools/node-wasm"

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
  parseDocument(textDocument: TextDocument): ParseServiceResult {
    const content = textDocument.getText()
    const result = Herb.parse(content)

    const errorVisitor = new ErrorVisitor()
    result.visit(errorVisitor)

    return {
      document: result.value,
      diagnostics: errorVisitor.diagnostics
    }
  }
}
