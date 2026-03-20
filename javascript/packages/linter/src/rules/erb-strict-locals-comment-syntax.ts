import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isPartialFile } from "./file-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ERBStrictLocalsNode } from "@herb-tools/core"

function extractERBCommentContent(content: string): string {
  return content.trim()
}

function extractRubyCommentContent(content: string): string | null {
  const match = content.match(/^\s*#\s*(.*)$/)

  return match ? match[1].trim() : null
}

function looksLikeLocalsDeclaration(content: string): boolean {
  return /^locals?\b/.test(content) && /[(:)]/.test(content)
}

function detectLocalsWithoutColon(content: string): boolean {
  return /^locals?\(/.test(content)
}

function detectSingularLocal(content: string): boolean {
  return content.startsWith("local:")
}

function detectMissingColonBeforeParens(content: string): boolean {
  return /^locals\s+\(/.test(content)
}

class ERBStrictLocalsCommentSyntaxVisitor extends BaseRuleVisitor {
  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    const isPartial = isPartialFile(this.context.fileName)

    if (isPartial === false) {
      this.addOffense(
        "Strict locals (`locals:`) only work in partials (files starting with `_`). This declaration will be ignored.",
        node.location
      )
    }

    if (node.errors.length > 0) return

    const content = node.content?.value ?? ""
    const trimmed = content.trim()
    const afterLocals = trimmed.slice("locals:".length)

    if (afterLocals.length > 0 && afterLocals[0] !== " ") {
      this.addOffense(
        "Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.",
        node.location
      )
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    const openingTag = node.tag_opening?.value
    const content = node.content?.value

    if (!content) return

    if (openingTag === "<%" || openingTag === "<%-") {
      const rubyComment = extractRubyCommentContent(content)

      if (rubyComment && looksLikeLocalsDeclaration(rubyComment)) {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\` for strict locals comments. Only ERB comment syntax is recognized by Rails.`,
          node.location
        )
      }

      return
    }

    if (openingTag !== "<%#") return

    const commentContent = extractERBCommentContent(content)
    const remainder = commentContent.match(/^locals?\b(.*)/s)?.[1]

    if (!remainder || !/[(:)]/.test(remainder)) return

    if (detectSingularLocal(commentContent)) {
      this.addOffense("Use `locals:` (plural), not `local:`.", node.location)
      return
    }

    if (detectLocalsWithoutColon(commentContent)) {
      this.addOffense(
        "Use `locals:` with a colon, not `locals()`. Correct format: `<%# locals: (...) %>`.",
        node.location
      )
      return
    }

    if (detectMissingColonBeforeParens(commentContent)) {
      this.addOffense(
        "Use `locals:` with a colon before the parentheses, not `locals (`.",
        node.location
      )
      return
    }
  }
}

export class ERBStrictLocalsCommentSyntaxRule extends ParserRule {
  static ruleName = "erb-strict-locals-comment-syntax"

  get parserOptions() {
    return { strict_locals: true }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBStrictLocalsCommentSyntaxVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
