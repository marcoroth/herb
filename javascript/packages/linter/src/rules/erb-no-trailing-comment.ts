import { Location, stringIndexFromByteOffset } from "@herb-tools/core"

import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBNode, ERBContentNode, HerbBackend } from "@herb-tools/core"

const RUBY_OPENINGS = new Set(["<%", "<%-", "<%=", "<%=="])

// Tags like `<% # comment %>` are reported by `erb-comment-syntax`.
const COMMENT_ONLY = /^ +#/

// Prism reports `# ...` comments as type 0 and `=begin`/`=end` comments as type 1.
const INLINE_COMMENT = 0

const OWN_LINE = /\n[ \t]*$/

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
  constructor(ruleName: string, context: Partial<LintContext> | undefined, private herb: HerbBackend, private autofixable: boolean) {
    super(ruleName, context)
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

    this.addOffense(
      "A Ruby comment at the end of an ERB tag also comments out the code that the template engine appends after the tag. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line.",
      this.commentLocation(contentToken.location.start, content, comment),
      this.autofixContextFor(node as ERBContentNode, content, comment),
    )
  }

  private commentLocation(contentStart: { line: number, column: number }, content: string, comment: TrailingComment): Location {
    const lines = content.slice(0, comment.start).split("\n")
    const line = contentStart.line + lines.length - 1
    const column = lines.length === 1 ? contentStart.column + lines[0].length : lines[lines.length - 1].length

    return Location.from(line, column, line, column + comment.end - comment.start)
  }

  private autofixContextFor(node: ERBContentNode, content: string, comment: TrailingComment): ERBNoTrailingCommentAutofixContext | undefined {
    if (!this.autofixable) return undefined

    const prefix = content.slice(0, comment.start)

    if (prefix.trim() === "") return undefined

    // Keep the line break before a comment on its own line, so a heredoc terminator stays alone on its line.
    const code = OWN_LINE.test(prefix) ? prefix : `${prefix.replace(/[ \t]+$/, "")} `
    const commentText = content.slice(comment.start + 1, comment.end)
    const trailing = content.slice(comment.end)

    return {
      node,
      originalContent: content,
      content: `${code}%><%#${commentText}${trailing}`,
    }
  }
}

export class ERBNoTrailingCommentRule extends ParserRule<ERBNoTrailingCommentAutofixContext> {
  static unsafeAutocorrectable = true
  static autofixRequiresContext = true
  static consumesParserErrors = true
  static ruleName = "erb-no-trailing-comment"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBNoTrailingCommentAutofixContext>[] {
    if (context?.templateEngine === "herb") return []
    if (!context?.herb) return []

    // The printer can't print a document with parse errors, so these offenses are reported without an autofix.
    const autofixable = result.recursiveErrors().length === 0
    const visitor = new ERBNoTrailingCommentVisitor(this.ruleName, context, context.herb, autofixable)

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
