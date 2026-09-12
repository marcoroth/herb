import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Visitor, commentedERBTagPrefixes } from "@herb-tools/core"

import type { HerbBackend, Node, HerbError, DocumentNode, ParseResult, ParseOptions } from "@herb-tools/core"

import { lspRangeFromLocation } from "./range_utils"

import type { ProjectConfig } from "./types.js"

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
  private config?: ProjectConfig

  constructor(backend: HerbBackend) {
    this.backend = backend
  }

  setConfig(config?: ProjectConfig) {
    this.config = config
  }

  private get parserOptions(): ParseOptions {
    return this.config?.parserOptions ?? {}
  }

  parseDocument(textDocument: TextDocument): ParseServiceResult {
    const content = textDocument.getText()
    const result = this.backend.parse(content, this.parserOptions)

    const errorVisitor = new ErrorVisitor()
    result.visit(errorVisitor)

    return {
      document: result.value,
      diagnostics: errorVisitor.diagnostics
    }
  }

  parseContent(content: string, options?: ParseOptions): ParseResult {
    return this.backend.parse(content, { ...this.parserOptions, ...options })
  }

  commentedERBTagPrefixes(erbOpeners?: string[]): string[] {
    return commentedERBTagPrefixes(this.backend.defaultERBOpenings(), erbOpeners ?? this.parserOptions.erb_openers ?? [])
  }
}
