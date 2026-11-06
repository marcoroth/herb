import { Location, stringIndexFromByteOffset } from "@herb-tools/core"

import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, LintSeverity, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBNode, ERBContentNode, HerbBackend } from "@herb-tools/core"
import type { TemplateEngine } from "@herb-tools/config"

const RUBY_OPENINGS = new Set(["<%", "<%-", "<%=", "<%=="])
const STATEMENT_OPENINGS = new Set(["<%", "<%-"])

const COMMENT_ONLY = /^ +#/
const INLINE_COMMENT = 0
const OWN_LINE = /\n[ \t]*$/
const BLANK_BEFORE_TAG = /^[ \t]*$/
const BLANK_AFTER_TAG = /^[ \t]*\r?$/

const BREAKING_MESSAGE = "A Ruby comment at the end of an ERB tag also comments out the code that the template engine appends after the tag. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line."
const FRAGILE_MESSAGE = "Avoid Ruby comments at the end of ERB tags. This tag still renders correctly, but the comment breaks the template as soon as anything else is added to this line or the template is rendered by an engine that doesn't trim it. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line."

interface TrailingComment {
  start: number
  end: number
}

interface ERBNoTrailingCommentAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBContentNode>
  originalContent: string
  content: string
}

function findTrailingComment(herb: HerbBackend, content: string): TrailingComment | null {
  const code = content.trimEnd()
  const trailing = content.slice(code.length)

  if (trailing.includes("\n")) return null

  let comments

  try {
    comments = herb.parseRuby(code).comments
  } catch {
    return null
  }

  for (const comment of comments) {
    if (comment.type !== INLINE_COMMENT) continue

    const { startOffset, length } = comment.location
    const end = stringIndexFromByteOffset(code, startOffset + length)

    if (end < code.length) continue

    return { start: stringIndexFromByteOffset(code, startOffset), end }
  }

  return null
}

class ERBNoTrailingCommentVisitor extends BaseRuleVisitor<ERBNoTrailingCommentAutofixContext> {
  private lines: string[]

  constructor(ruleName: string, context: Partial<LintContext> | undefined, private herb: HerbBackend, private autofixable: boolean, source: string, private templateEngine: TemplateEngine | undefined) {
    super(ruleName, context)

    this.lines = source.split("\n")
  }

  visitERBNode(node: ERBNode): void {
    if (!("tag_opening" in node) || !("content" in node)) return

    const opening = node.tag_opening?.value
    const contentToken = node.content
    const content = contentToken?.value

    if (!opening || !RUBY_OPENINGS.has(opening)) return
    if (!contentToken || !content || !content.includes("#")) return
    if (COMMENT_ONLY.test(content)) return

    const comment = findTrailingComment(this.herb, content)

    if (!comment) return

    const trimmed = STATEMENT_OPENINGS.has(opening) && this.isOnTrimmedLine(node)
    const breaks = this.templateEngine !== "herb" && !trimmed
    const severity: LintSeverity | undefined = breaks ? undefined : "warning"

    this.addOffense(
      breaks ? BREAKING_MESSAGE : FRAGILE_MESSAGE,
      this.commentLocation(contentToken.location.start, content, comment),
      this.autofixContextFor(node as ERBContentNode, content, comment, trimmed),
      severity,
    )
  }

  private isOnTrimmedLine(node: ERBNode): boolean {
    if (!("tag_closing" in node)) return false

    const opening = node.tag_opening?.location
    const closing = node.tag_closing?.location

    if (!opening || !closing) return false

    const before = Array.from(this.lines[opening.start.line - 1] ?? "").slice(0, opening.start.column).join("")
    const after = Array.from(this.lines[closing.end.line - 1] ?? "").slice(closing.end.column).join("")

    return BLANK_BEFORE_TAG.test(before) && BLANK_AFTER_TAG.test(after)
  }

  private commentLocation(contentStart: { line: number, column: number }, content: string, comment: TrailingComment): Location {
    const lines = content.slice(0, comment.start).split("\n")
    const line = contentStart.line + lines.length - 1
    const column = lines.length === 1 ? contentStart.column + lines[0].length : lines[lines.length - 1].length

    return Location.from(line, column, line, column + comment.end - comment.start)
  }

  private autofixContextFor(node: ERBContentNode, content: string, comment: TrailingComment, unsafe: boolean): ERBNoTrailingCommentAutofixContext | undefined {
    if (!this.autofixable) return undefined

    const prefix = content.slice(0, comment.start)

    if (prefix.trim() === "") return undefined

    const code = OWN_LINE.test(prefix) ? prefix : `${prefix.replace(/[ \t]+$/, "")} `
    const commentText = content.slice(comment.start + 1, comment.end)
    const trailing = content.slice(comment.end)

    return {
      node,
      unsafe,
      originalContent: content,
      content: `${code}%><%#${commentText}${trailing}`,
    }
  }
}

export class ERBNoTrailingCommentRule extends ParserRule<ERBNoTrailingCommentAutofixContext> {
  static autocorrectable = true
  static autofixRequiresContext = true
  static consumesParserErrors = true
  static ruleName = "erb-no-trailing-comment"
  static introducedIn = this.version("0.11.2")
  static defaultEnabledIn = this.version("0.11.2")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBNoTrailingCommentAutofixContext>[] {
    if (!context?.herb) return []

    const autofixable = result.recursiveErrors().length === 0
    const visitor = new ERBNoTrailingCommentVisitor(this.ruleName, context, context.herb, autofixable, result.source, context.templateEngine)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBNoTrailingCommentAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, originalContent, content } = offense.autofixContext

    if (!node.content) return null
    if (node.content.value !== originalContent) return null

    node.content.value = content

    return result
  }
}
