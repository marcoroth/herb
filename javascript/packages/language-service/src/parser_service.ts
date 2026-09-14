import { TextDocument } from "vscode-languageserver-textdocument"
import { lspRangeFromLocation } from "./range_utils"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types"
import { Visitor, commentedERBTagPrefixes } from "@herb-tools/core"

import type { ProjectConfig } from "./types.js"
import type { HerbBackend, Node, HerbError, DocumentNode, ParseResult, ParseOptions } from "@herb-tools/core"

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

export type ProjectConfigResolver = (uri: string) => ProjectConfig | undefined

export class ParserService {
  private readonly backend: HerbBackend
  private config?: ProjectConfig
  private resolveConfig?: ProjectConfigResolver

  constructor(backend: HerbBackend) {
    this.backend = backend
  }

  setConfig(config?: ProjectConfig) {
    this.config = config
  }

  setConfigResolver(resolveConfig?: ProjectConfigResolver) {
    this.resolveConfig = resolveConfig
  }

  private configFor(uri?: string): ProjectConfig | undefined {
    if (uri === undefined) return this.config

    return this.resolveConfig?.(uri) ?? this.config
  }

  private parserOptionsFor(uri?: string): ParseOptions {
    return this.configFor(uri)?.parserOptions ?? {}
  }

  parseDocument(textDocument: TextDocument): ParseServiceResult {
    const content = textDocument.getText()
    const result = this.backend.parse(content, this.parserOptionsFor(textDocument.uri))

    const errorVisitor = new ErrorVisitor()
    result.visit(errorVisitor)

    return {
      document: result.value,
      diagnostics: errorVisitor.diagnostics
    }
  }

  parseContent(content: string, options?: ParseOptions, uri?: string): ParseResult {
    return this.backend.parse(content, { ...this.parserOptionsFor(uri), ...options })
  }

  commentedERBTagPrefixes(erbOpeners?: string[], uri?: string): string[] {
    return commentedERBTagPrefixes(this.backend.defaultERBOpenings(), erbOpeners ?? this.parserOptionsFor(uri).erb_openers ?? [])
  }
}
