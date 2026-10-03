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

export interface ParserServiceOptions {
  cacheSize?: number
}

export const DEFAULT_PARSE_CACHE_SIZE = 6

export class ParserService {
  private readonly backend: HerbBackend
  private config?: ProjectConfig
  private resolveConfig?: ProjectConfigResolver
  readonly #cacheSize: number
  readonly #cache = new Map<string, unknown>()

  constructor(backend: HerbBackend, options: ParserServiceOptions = {}) {
    this.backend = backend
    this.#cacheSize = options.cacheSize ?? DEFAULT_PARSE_CACHE_SIZE
  }

  setConfig(config?: ProjectConfig) {
    this.config = config
    this.clearCache()
  }

  setConfigResolver(resolveConfig?: ProjectConfigResolver) {
    this.resolveConfig = resolveConfig
    this.clearCache()
  }

  clearCache() {
    this.#cache.clear()
  }

  #remember<Value>(key: string, compute: () => Value): Value {
    if (this.#cacheSize <= 0) return compute()

    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key) as Value

      this.#cache.delete(key)
      this.#cache.set(key, cached)

      return cached
    }

    const value = compute()

    this.#cache.set(key, value)

    while (this.#cache.size > this.#cacheSize) {
      this.#cache.delete(this.#cache.keys().next().value!)
    }

    return value
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
    const result = this.parseContent(content, undefined, textDocument.uri)

    const diagnostics = this.#remember(`diagnostics\u0000${this.#cacheKey(content, undefined, textDocument.uri)}`, () => {
      const errorVisitor = new ErrorVisitor()
      result.visit(errorVisitor)

      return errorVisitor.diagnostics
    })

    return { document: result.value, diagnostics }
  }

  parseContent(content: string, options?: ParseOptions, uri?: string): ParseResult {
    const effectiveOptions = { ...this.parserOptionsFor(uri), ...options }

    return this.#remember(
      `parse\u0000${JSON.stringify(effectiveOptions)}\u0000${content}`,
      () => this.backend.parse(content, effectiveOptions)
    )
  }

  #cacheKey(content: string, options: ParseOptions | undefined, uri?: string): string {
    return `${JSON.stringify({ ...this.parserOptionsFor(uri), ...options })}\u0000${content}`
  }

  commentedERBTagPrefixes(erbOpeners?: string[], uri?: string): string[] {
    return commentedERBTagPrefixes(this.backend.defaultERBOpenings(), erbOpeners ?? this.parserOptionsFor(uri).erb_openers ?? [])
  }
}
