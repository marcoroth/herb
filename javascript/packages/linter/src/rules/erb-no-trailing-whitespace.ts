import { Location, isHTMLOpenTagNode, isHTMLTextNode, isLiteralNode, Visitor } from "@herb-tools/core"
import { getTagName, findNodeAtPosition } from "./rule-utils.js"
import { ParserRule, Mutable, BaseAutofixContext } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLTextNode, LiteralNode, ParseResult, DocumentNode, ERBNode } from "@herb-tools/core"

const TRAILING_WHITESPACE = /[ \t\r\v\f\u00A0]+$/
const TRAILING_WHITESPACE_BEFORE_NEWLINE = /[ \t\r\v\f\u00A0]+(?=\n)/g
const ONLY_WHITESPACE = /^[ \t\r\v\f\u00A0]+$/

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
  node: Mutable<HTMLTextNode> | Mutable<LiteralNode>
}

class SkipZoneCollector extends Visitor {
  skipZones: SkipZone[] = []

  SKIP_TAGS = new Set(["pre", "textarea", "script", "style"])

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (isHTMLOpenTagNode(node.open_tag)) {
      const tagName = getTagName(node.open_tag)

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
  name = "erb-no-trailing-whitespace"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
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
        const node = findNodeAtPosition(result.value, candidate.line, candidate.column, (n) => isHTMLTextNode(n) || isLiteralNode(n)) as HTMLTextNode | LiteralNode | null

        offenses.push({
          rule: this.name,
          message: "Extra whitespace detected at end of line.",
          location,
          autofixContext: node ? { node } : undefined
        })
      }
    }

    return offenses
  }

  private findTrailingWhitespaceCandidates(lines: string[]): TrailingWhitespaceCandidate[] {
    const candidates: TrailingWhitespaceCandidate[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(TRAILING_WHITESPACE)

      if (match && match.index !== undefined) {
        candidates.push({
          line: i + 1,
          column: match.index,
          length: match[0].length
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

    if (node.type === "AST_HTML_TEXT_NODE" || node.type === "AST_LITERAL_NODE") {
      let fixedContent = node.content.replace(TRAILING_WHITESPACE_BEFORE_NEWLINE, "")
      const offenseIsAtEndOfContent = this.isOffenseAtEndOfContent(offense, node)

      if (offenseIsAtEndOfContent) {
        if (this.hasTrailingWhitespaceNotIndentation(fixedContent)) {
          fixedContent = fixedContent.replace(TRAILING_WHITESPACE, "")
        }

        if (ONLY_WHITESPACE.test(fixedContent) && node.location.start.column !== 0) {
          fixedContent = ""
        }
      }

      node.content = fixedContent
    }

    return result
  }

  private isOffenseAtEndOfContent(offense: LintOffense<ERBNoTrailingWhitespaceAutofixContext>, node: Mutable<HTMLTextNode> | Mutable<LiteralNode>): boolean {
    return offense.location.end.line === node.location.end.line && offense.location.end.column === node.location.end.column
  }

  private hasTrailingWhitespaceNotIndentation(content: string): boolean {
    if (content.endsWith("\n")) return false

    const endMatch = content.match(TRAILING_WHITESPACE)
    if (!endMatch) return false

    const whitespaceStart = content.length - endMatch[0].length
    if (whitespaceStart === 0) return false

    const characterBefore = content[whitespaceStart - 1]
    if (characterBefore === "\n") return false

    return true
  }
}
