import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, Token, ERBNode } from "@herb-tools/core"
import { Location } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, LintSeverity, FullRuleConfig } from "../types.js"

interface ERBNoExtraWhitespaceAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
  openTag: Token
  closeTag: Token
  content: string
  fixType: "after-open" | "before-close" | "after-comment-equals"
}

class ERBNoExtraWhitespaceInsideTagsVisitor extends BaseRuleVisitor<ERBNoExtraWhitespaceAutofixContext> {

  visitERBNode(node: ERBNode): void {
    const openTag = node.tag_opening
    const closeTag = node.tag_closing
    const { value } = node.content ?? {}

    if (!openTag || !closeTag || !value) return

    if (this.hasExtraLeadingWhitespace(value)) {
      this.reportWhitespace(node, openTag, closeTag, value, "start", 0, `Remove extra whitespace after \`${openTag.value}\`.`, "after-open")
    }

    if (openTag.value === "<%#") {
      const prefix = this.getCommentedTagPrefix(value)

      if (prefix) {
        const afterPrefix = value.substring(prefix.length)
        const tag = `<%#${prefix}`
        const hasExtraWhitespace = afterPrefix.match(/^\s{2,}/) && !afterPrefix.startsWith("  \n") && !afterPrefix.startsWith("\n")

        if (hasExtraWhitespace) {
          this.reportWhitespace(node, openTag, closeTag, value, "start", prefix.length, `Remove extra whitespace after \`${tag}\`. This looks like a temporarily commented ERB tag.`, "after-comment-equals", "info")
        } else {
          this.addOffense(
            `\`${tag}\` looks like a temporarily commented ERB tag.`,
            openTag.location,
            { node, openTag, closeTag, content: value, fixType: "after-comment-equals", unsafe: true },
            "info"
          )
        }
      }
    }

    if (this.hasExtraTrailingWhitespace(value)) {
      this.reportWhitespace(node, openTag, closeTag, value, "end", 0, `Remove extra whitespace before \`${closeTag.value}\`.`, "before-close")
    }
  }

  private getCommentedTagPrefix(content: string): string | null {
    if (content.startsWith("graphql")) return "graphql"
    if (content.startsWith("%=")) return "%="
    if (content.startsWith("==")) return "=="
    if (content.startsWith("%")) return "%"
    if (content.startsWith("=")) return "="
    if (content.startsWith("-")) return "-"

    return null
  }

  private hasExtraLeadingWhitespace(content: string): boolean {
    return content.startsWith("  ") && !content.startsWith("  \n")
  }

  private hasExtraTrailingWhitespace(content: string): boolean {
    return !content.includes("\n") && /\s{2,}$/.test(content)
  }

  private getWhitespaceLocation(node: ERBNode, content: string, position: "start" | "end", offset: number = 0): Location {
    const contentLocation = node.content!.location

    if (position === "start") {
      const match = content.substring(offset).match(/^\s+/)
      const length = match ? match[0].length : 0
      const startColumn = contentLocation.start.column + offset

      return Location.from(
        contentLocation.start.line,
        startColumn,
        contentLocation.start.line,
        startColumn + length
      )
    } else {
      const match = content.match(/\s+$/)
      const length = match ? match[0].length : 0

      return Location.from(
        contentLocation.end.line,
        contentLocation.end.column - length,
        contentLocation.end.line,
        contentLocation.end.column
      )
    }
  }

  private reportWhitespace(
    node: ERBNode,
    openTag: Token,
    closeTag: Token,
    content: string,
    position: "start" | "end",
    offset: number,
    message: string,
    fixType: "after-open" | "before-close" | "after-comment-equals",
    severity?: LintSeverity,
    unsafe?: boolean,
  ): void {
    const location = this.getWhitespaceLocation(node, content, position, offset)
    this.addOffense(message, location, {
      node,
      openTag,
      closeTag,
      content,
      fixType,
      unsafe,
    }, severity)
  }
}

export class ERBNoExtraWhitespaceRule extends ParserRule<ERBNoExtraWhitespaceAutofixContext> {
  static autocorrectable = true
  static ruleName = "erb-no-extra-whitespace-inside-tags"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBNoExtraWhitespaceAutofixContext>[] {
    const visitor = new ERBNoExtraWhitespaceInsideTagsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBNoExtraWhitespaceAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, fixType } = offense.autofixContext
    if (!node.content) return null

    const content = node.content.value

    switch (fixType) {
      case "before-close":
        node.content.value = content.replace(/\s{2,}$/, " ")
        break

      case "after-open":
        node.content.value = content.replace(/^\s{2,}/, " ")
        break

      case "after-comment-equals": {
        const prefix = content.startsWith("graphql") ? "graphql" : content.startsWith("%=") ? "%=" : content.startsWith("==") ? "==" : content.startsWith("%") ? "%" : content.startsWith("=") ? "=" : content.startsWith("-") ? "-" : null

        if (prefix) {
          const afterPrefix = content.substring(prefix.length)
          node.content.value = prefix + " " + afterPrefix.replace(/^\s{2,}/, "")
        }

        break
      }
      default:
        return null
    }

    return result
  }
}
