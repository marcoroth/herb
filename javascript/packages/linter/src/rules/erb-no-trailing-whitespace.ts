import { Location, Visitor } from "@herb-tools/core"
import { ParserRule, Mutable, BaseAutofixContext } from "../types.js"

import { isHTMLOpenTagNode, isHTMLTextNode, isLiteralNode, isWhitespaceNode, getTagLocalName } from "@herb-tools/core"
import { findNodeAtPosition } from "./rule-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLTextNode, LiteralNode, WhitespaceNode, ParseResult, DocumentNode, ERBNode } from "@herb-tools/core"

const WHITESPACE_CHARACTERS = new Set([" ", "\t", "\r", "\v", "\f", "\u00A0"])

function trailingWhitespaceStart(value: string): number {
  let start = value.length

  while (start > 0 && WHITESPACE_CHARACTERS.has(value[start - 1])) start--

  return start
}

function trimTrailingWhitespace(value: string): string {
  const start = trailingWhitespaceStart(value)

  return start === value.length ? value : value.slice(0, start)
}

function trimWhitespaceBeforeNewlines(value: string): string {
  if (!value.includes("\n")) return value

  const segments = value.split("\n")

  for (let index = 0; index < segments.length - 1; index++) {
    segments[index] = trimTrailingWhitespace(segments[index])
  }

  return segments.join("\n")
}

function isOnlyWhitespace(value: string): boolean {
  return value.length > 0 && trailingWhitespaceStart(value) === 0
}

interface SkipZone {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

interface TrailingWhitespaceCandidate {
  line: number
  column: number
  length: number
}

interface ERBNoTrailingWhitespaceAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLTextNode> | Mutable<LiteralNode> | Mutable<WhitespaceNode>
}

class SkipZoneCollector extends Visitor {
  skipZones: SkipZone[] = []

  SKIP_TAGS = new Set(["pre", "textarea", "script", "style"])

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (isHTMLOpenTagNode(node.open_tag)) {
      const tagName = getTagLocalName(node.open_tag)

      if (tagName && this.SKIP_TAGS.has(tagName)) {
        this.skipZones.push({
          startLine: node.location.start.line,
          startColumn: node.location.start.column,
          endLine: node.location.end.line,
          endColumn: node.location.end.column
        })

        return
      }
    }

    super.visitHTMLElementNode(node)
  }

  visitERBNode(node: ERBNode) {
    if (!node.tag_opening) return
    if (!node.tag_closing) return

    this.skipZones.push({
      startLine: node.tag_opening.location.start.line,
      startColumn: node.tag_opening.location.start.column,
      endLine: node.tag_closing.location.end.line,
      endColumn: node.tag_closing.location.end.column
    })
  }
}

export class ERBNoTrailingWhitespaceRule extends ParserRule<ERBNoTrailingWhitespaceAutofixContext> {
  static autocorrectable = true
  static ruleName = "erb-no-trailing-whitespace"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense<ERBNoTrailingWhitespaceAutofixContext>[] {
    const offenses: UnboundLintOffense<ERBNoTrailingWhitespaceAutofixContext>[] = []
    const lines = result.source.split("\n")
    const candidates = this.findTrailingWhitespaceCandidates(lines)

    if (candidates.length === 0) return offenses

    const skipZones = this.collectSkipZones(result.value)

    for (const candidate of candidates) {
      if (!this.isInSkipZone(candidate, skipZones)) {
        const location = Location.from(candidate.line, candidate.column, candidate.line, candidate.column + candidate.length)
        const node = findNodeAtPosition(result.value, candidate.line, candidate.column, (n) => isHTMLTextNode(n) || isLiteralNode(n) || isWhitespaceNode(n)) as HTMLTextNode | LiteralNode | WhitespaceNode | null

        offenses.push(this.createOffense("Extra whitespace detected at end of line.", location, node ? { node } : undefined))
      }
    }

    return offenses
  }

  private findTrailingWhitespaceCandidates(lines: string[]): TrailingWhitespaceCandidate[] {
    const candidates: TrailingWhitespaceCandidate[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const start = trailingWhitespaceStart(line)

      if (start < line.length) {
        candidates.push({
          line: i + 1,
          column: [...line.slice(0, start)].length,
          length: [...line.slice(start)].length
        })
      }
    }

    return candidates
  }

  private collectSkipZones(root: DocumentNode): SkipZone[] {
    const collector = new SkipZoneCollector()

    collector.visit(root)

    return collector.skipZones
  }

  private isInSkipZone(candidate: TrailingWhitespaceCandidate, skipZones: SkipZone[]): boolean {
    for (const zone of skipZones) {
      if (candidate.line < zone.startLine || candidate.line > zone.endLine) continue
      if (candidate.line === zone.endLine && candidate.column >= zone.endColumn) continue
      if (candidate.line === zone.startLine && candidate.column < zone.startColumn) continue

      return true
    }

    return false
  }

  autofix(offense: LintOffense<ERBNoTrailingWhitespaceAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (node.type === "AST_WHITESPACE_NODE") {
      return this.autofixWhitespaceNode(offense, node, result)
    }

    if (node.type === "AST_HTML_TEXT_NODE" || node.type === "AST_LITERAL_NODE") {
      let fixedContent = trimWhitespaceBeforeNewlines(node.content)
      const offenseIsAtEndOfContent = this.isOffenseAtEndOfContent(offense, node)

      if (offenseIsAtEndOfContent) {
        if (this.hasTrailingWhitespaceNotIndentation(fixedContent)) {
          fixedContent = trimTrailingWhitespace(fixedContent)
        }

        if (isOnlyWhitespace(fixedContent) && node.location.start.column !== 0) {
          fixedContent = ""
        }
      }

      node.content = fixedContent
    }

    return result
  }

  private autofixWhitespaceNode(offense: LintOffense<ERBNoTrailingWhitespaceAutofixContext>, node: Mutable<WhitespaceNode>, result: ParseResult): ParseResult | null {
    if (!node.value) return null

    const originalValue = node.value.value
    let fixedValue = trimWhitespaceBeforeNewlines(originalValue)

    if (this.isOffenseAtEndOfContent(offense, node)) {
      fixedValue = trimTrailingWhitespace(fixedValue)
    }

    if (fixedValue === originalValue) return null

    node.value.value = fixedValue

    return result
  }

  private isOffenseAtEndOfContent(offense: LintOffense<ERBNoTrailingWhitespaceAutofixContext>, node: Mutable<HTMLTextNode> | Mutable<LiteralNode> | Mutable<WhitespaceNode>): boolean {
    return offense.location.end.line === node.location.end.line && offense.location.end.column === node.location.end.column
  }

  private hasTrailingWhitespaceNotIndentation(content: string): boolean {
    if (content.endsWith("\n")) return false

    const whitespaceStart = trailingWhitespaceStart(content)
    if (whitespaceStart === content.length) return false
    if (whitespaceStart === 0) return false

    const characterBefore = content[whitespaceStart - 1]
    if (characterBefore === "\n") return false

    return true
  }
}
