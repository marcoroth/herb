import { Range } from "vscode-languageserver/node"
import { ParserService } from "./parser_service"
import { RubyReferenceCollector } from "./ruby_reference_collector"
import { StrictLocalsCollector } from "./strict_locals_collector"
import { RootElementCollector } from "./root_element_collector"

import { RUBY_KEYWORDS, helperExists, stringIndexFromByteOffset, getAttributes, getAttributeName, getStaticAttributeValue, getTagName, getTokenList } from "@herb-tools/core"

import type { TextDocument } from "vscode-languageserver-textdocument"
import type { DocumentNode, HTMLElementNode } from "@herb-tools/core"
import type { RubyReference } from "./ruby_reference_collector"

const FALLBACK_NAME = "partial"
const SEMANTIC_CLASS_LIMIT = 2
const LOCAL_ASSIGNS = "local_assigns"
const ROUTE_HELPER = /_(path|url)$/
const PREDICATE_OR_BANG = /[?!]$/
const LOCAL_NAME = /^[a-z_][a-zA-Z0-9_]*$/

export interface ExtractedLocal {
  name: string
  expression: string
}

export interface ExtractionAnalysis {
  range: Range
  locals: ExtractedLocal[]
  source: string
  suggestedName: string
}

interface SourceRewrite {
  startOffset: number
  length: number
  replacement: string
}

interface SelectionBounds {
  range: Range
  startOffset: number
  endOffset: number
}

interface LocalCandidate extends ExtractedLocal {
  startOffset: number
}

interface StrictLocalsContext {
  names: Set<string>
  inferLocals: boolean
}

export class ExtractPartialAnalyzer {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  analyze(textDocument: TextDocument, requestedRange: Range): ExtractionAnalysis | null {
    const text = textDocument.getText()
    const bounds = this.selectionBounds(textDocument, text, requestedRange)

    if (!bounds) return null

    const selection = text.slice(bounds.startOffset, bounds.endOffset)
    const selectionResult = this.parserService.parseContent(selection)

    if (selectionResult.failed) return null

    const document = this.parserService.parseContent(text, {
      prism_program: true,
      strict_locals: true,
      track_whitespace: true,
    })

    if (document.failed) return null

    const startByte = this.byteLength(text.slice(0, bounds.startOffset))
    const endByte = startByte + this.byteLength(selection)
    const collector = new RubyReferenceCollector()

    if (document.value.prismNode) {
      collector.visit(document.value.prismNode)
    }

    const strictLocals = this.strictLocals(document.value)

    const { locals, rewrites } = this.collectLocals(collector, startByte, endByte, {
      names: strictLocals.names,
      inferLocals: !strictLocals.declared && this.isPartial(textDocument.uri),
    })

    const body = this.dedent(
      this.applyRewrites(selection, bounds.startOffset, text, rewrites),
      this.baseIndentation(text, bounds.startOffset)
    )

    return {
      range: bounds.range,
      locals,
      source: this.partialSource(body, locals),
      suggestedName: this.suggestName(selectionResult.value),
    }
  }

  private selectionBounds(textDocument: TextDocument, text: string, requestedRange: Range): SelectionBounds | null {
    let startOffset = textDocument.offsetAt(requestedRange.start)
    let endOffset = textDocument.offsetAt(requestedRange.end)

    while (startOffset < endOffset && /\s/.test(text.charAt(startOffset))) startOffset += 1
    while (endOffset > startOffset && /\s/.test(text.charAt(endOffset - 1))) endOffset -= 1

    if (startOffset >= endOffset) return null

    return {
      startOffset,
      endOffset,
      range: Range.create(textDocument.positionAt(startOffset), textDocument.positionAt(endOffset)),
    }
  }

  private collectLocals(collector: RubyReferenceCollector, startByte: number, endByte: number, strictLocals: StrictLocalsContext): { locals: ExtractedLocal[], rewrites: SourceRewrite[] } {
    const isInside = (reference: RubyReference) => reference.startOffset >= startByte && reference.startOffset + reference.length <= endByte
    const boundInside = new Set(collector.localBindings.filter(isInside).map(binding => binding.name))
    const assignedInside = new Set(collector.instanceVariableWrites.filter(isInside).map(write => write.name))

    const candidates: LocalCandidate[] = []

    for (const read of collector.localReads) {
      if (!isInside(read)) continue
      if (boundInside.has(read.name)) continue

      candidates.push({ name: read.name, expression: read.name, startOffset: read.startOffset })
    }

    for (const call of collector.bareCalls) {
      if (!isInside(call)) continue
      if (boundInside.has(call.name)) continue

      const isLocal = strictLocals.names.has(call.name) || (strictLocals.inferLocals && this.isProbableLocal(call.name))
      if (!isLocal) continue

      candidates.push({ name: call.name, expression: call.name, startOffset: call.startOffset })
    }

    const variableNames = new Set(candidates.map(candidate => candidate.name))
    const rewrites: SourceRewrite[] = []

    for (const read of collector.instanceVariableReads) {
      if (!isInside(read)) continue
      if (assignedInside.has(read.name)) continue

      const name = read.name.slice(1)
      if (variableNames.has(name) || boundInside.has(name)) continue
      if (!this.isValidLocalName(name)) continue

      candidates.push({ name, expression: read.name, startOffset: read.startOffset })
      rewrites.push({ startOffset: read.startOffset, length: read.length, replacement: name })
    }

    const locals: ExtractedLocal[] = []
    const seen = new Set<string>()

    for (const candidate of candidates.sort((a, b) => a.startOffset - b.startOffset)) {
      if (seen.has(candidate.name)) continue

      seen.add(candidate.name)
      locals.push({ name: candidate.name, expression: candidate.expression })
    }

    return { locals, rewrites }
  }

  private strictLocals(document: DocumentNode): { names: Set<string>, declared: boolean } {
    const collector = new StrictLocalsCollector()

    collector.visit(document)

    return { names: collector.names, declared: collector.declared }
  }

  private isProbableLocal(name: string): boolean {
    if (!this.isValidLocalName(name)) return false
    if (PREDICATE_OR_BANG.test(name)) return false
    if (ROUTE_HELPER.test(name)) return false

    return !helperExists(name)
  }

  private isValidLocalName(name: string): boolean {
    if (!LOCAL_NAME.test(name)) return false
    if (RUBY_KEYWORDS.has(name)) return false

    return name !== LOCAL_ASSIGNS
  }

  private isPartial(uri: string): boolean {
    const basename = uri.split("/").at(-1) ?? ""

    return basename.startsWith("_")
  }

  private applyRewrites(selection: string, selectionStart: number, text: string, rewrites: SourceRewrite[]): string {
    let result = selection

    const sorted = [...rewrites].sort((a, b) => b.startOffset - a.startOffset)

    for (const rewrite of sorted) {
      const start = stringIndexFromByteOffset(text, rewrite.startOffset) - selectionStart
      const end = stringIndexFromByteOffset(text, rewrite.startOffset + rewrite.length) - selectionStart

      result = result.slice(0, start) + rewrite.replacement + result.slice(end)
    }

    return result
  }

  private baseIndentation(text: string, startOffset: number): string {
    const lineStart = text.lastIndexOf("\n", startOffset - 1) + 1
    const prefix = text.slice(lineStart, startOffset)

    return /^\s*$/.test(prefix) ? prefix : ""
  }

  private dedent(selection: string, baseIndentation: string): string {
    const lines = selection.split("\n")
    if (lines.length === 1) return selection

    const indentations = lines.slice(1).filter(line => line.trim().length > 0).map(line => line.match(/^[ \t]*/)![0].length)
    const shared = indentations.length > 0 ? Math.min(...indentations) : 0

    const width = Math.min(baseIndentation.length, shared)
    if (width === 0) return selection

    return [lines[0], ...lines.slice(1).map(line => line.slice(width))].join("\n")
  }

  private partialSource(body: string, locals: ExtractedLocal[]): string {
    const content = body.endsWith("\n") ? body : `${body}\n`
    if (locals.length === 0) return content

    const names = locals.map(local => `${local.name}:`).join(", ")

    return `<%# locals: (${names}) %>\n\n${content}`
  }

  private suggestName(document: DocumentNode): string {
    const collector = new RootElementCollector()

    collector.visit(document)

    const element = collector.element
    if (!element) return FALLBACK_NAME

    const identifier = getStaticAttributeValue(element, "id") || this.firstClassName(element) || getTagName(element)

    return this.normalizeName(identifier) || FALLBACK_NAME
  }

  private firstClassName(element: HTMLElementNode): string | null {
    const attribute = getAttributes(element).find(attribute => getAttributeName(attribute) === "class")
    if (!attribute) return null

    const classes = getTokenList(getStaticAttributeValue(attribute))
    if (classes.length > SEMANTIC_CLASS_LIMIT) return null

    return classes.at(0) ?? null
  }

  private normalizeName(value: string | null): string | null {
    if (!value) return null

    const name = value
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")

    return name.length > 0 ? name : null
  }

  private byteLength(value: string): number {
    return new TextEncoder().encode(value).length
  }
}
