import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isPartialFile } from "./file-utils.js"
import { hasBalancedParentheses, splitByTopLevelComma } from "./string-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

export const STRICT_LOCALS_PATTERN = /^locals:\s+\(.*\)\s*$/s

function isValidStrictLocalsFormat(content: string): boolean {
  return STRICT_LOCALS_PATTERN.test(content)
}

function extractERBCommentContent(content: string): string {
  return content.trim()
}

function extractRubyCommentContent(content: string): string | null {
  const match = content.match(/^\s*#\s*(.*)$/)

  return match ? match[1].trim() : null
}

function extractLocalsRemainder(content: string): string | null {
  const match = content.match(/^locals?\b(.*)$/)

  return match ? match[1] : null
}

function looksLikeLocalsDeclaration(content: string): boolean {
  return /^locals?\b/.test(content) && /[(:)]/.test(content)
}

function hasLocalsLikeSyntax(remainder: string): boolean {
  return /[(:)]/.test(remainder)
}

function detectLocalsWithoutColon(content: string): boolean {
  return /^locals?\(/.test(content)
}

function detectSingularLocal(content: string): boolean {
  return content.startsWith('local:')
}

function detectMissingColonBeforeParens(content: string): boolean {
  return /^locals\s+\(/.test(content)
}

function detectMissingSpaceAfterColon(content: string): boolean {
  return content.startsWith('locals:(')
}

function detectMissingParentheses(content: string): boolean {
  return /^locals:\s*[^(]/.test(content)
}

function detectEmptyLocalsWithoutParens(content: string): boolean {
  return /^locals:\s*$/.test(content)
}

function validateCommaUsage(inner: string): string | null {
  if (inner.startsWith(",") || inner.endsWith(",") || /,,/.test(inner)) {
    return "Unexpected comma in `locals:` parameters."
  }

  return null
}

function validateBlockArgument(param: string): string | null {
  if (param.startsWith("&")) {
    return `Block argument \`${param}\` is not allowed. Strict locals only support keyword arguments.`
  }

  return null
}

function validateSplatArgument(param: string): string | null {
  if (param.startsWith("*") && !param.startsWith("**")) {
    return `Splat argument \`${param}\` is not allowed. Strict locals only support keyword arguments.`
  }

  return null
}

function validateDoubleSplatArgument(param: string): string | null {
  if (param.startsWith("**")) {
    if (/^\*\*\w+$/.test(param)) {
      return null // Valid double-splat
    }

    return `Invalid double-splat syntax \`${param}\`. Use \`**name\` format (e.g., \`**attributes\`).`
  }

  return null
}

function validateKeywordArgument(param: string): string | null {
  if (!/^\w+:\s*/.test(param)) {
    if (/^\w+$/.test(param)) {
      return `Positional argument \`${param}\` is not allowed. Use keyword argument format: \`${param}:\`.`
    }

    return `Invalid parameter \`${param}\`. Use keyword argument format: \`name:\` or \`name: default\`.`
  }

  return null
}

function validateParameter(param: string): string | null {
  const trimmed = param.trim()

  if (!trimmed) return null

  return (
    validateBlockArgument(trimmed) ||
    validateSplatArgument(trimmed) ||
    validateDoubleSplatArgument(trimmed) ||
    (trimmed.startsWith("**") ? null : validateKeywordArgument(trimmed))
  )
}

function validateLocalsSignature(paramsContent: string): string | null {
  const match = paramsContent.match(/^\s*\(([\s\S]*)\)\s*$/)
  if (!match) return null

  const inner = match[1].trim()
  if (!inner) return null // Empty locals is valid: locals: ()

  const commaError = validateCommaUsage(inner)
  if (commaError) return commaError

  const params = splitByTopLevelComma(inner)

  for (const param of params) {
    const error = validateParameter(param)
    if (error) return error
  }

  return null
}

class ERBStrictLocalsCommentSyntaxVisitor extends BaseRuleVisitor {
  private seenStrictLocalsComment: boolean = false
  private firstStrictLocalsLocation: { line: number; column: number } | null = null

  visitERBContentNode(node: ERBContentNode): void {
    const openingTag = node.tag_opening?.value
    const content = node.content?.value

    if (!content) return

    const commentContent = this.extractCommentContent(openingTag, content, node)
    if (!commentContent) return

    const remainder = extractLocalsRemainder(commentContent)
    if (!remainder || !hasLocalsLikeSyntax(remainder)) return

    this.validateLocalsComment(commentContent, node)
  }

  private extractCommentContent(openingTag: string | undefined, content: string, node: ERBContentNode): string | null {
    if (openingTag === "<%#") {
      return extractERBCommentContent(content)
    }

    if (openingTag === "<%" || openingTag === "<%-") {
      const rubyComment = extractRubyCommentContent(content)

      if (rubyComment && looksLikeLocalsDeclaration(rubyComment)) {
        this.addOffense(`Use \`<%#\` instead of \`${openingTag} #\` for strict locals comments. Only ERB comment syntax is recognized by Rails.`, node.location)
      }
    }

    return null
  }

  private validateLocalsComment(commentContent: string, node: ERBContentNode): void {
    this.checkPartialFile(node)

    if (!hasBalancedParentheses(commentContent)) {
      this.addOffense("Unbalanced parentheses in `locals:` comment. Ensure all opening parentheses have matching closing parentheses.", node.location)
      return
    }

    if (isValidStrictLocalsFormat(commentContent)) {
      this.handleValidFormat(commentContent, node)
      return
    }

    this.handleInvalidFormat(commentContent, node)
  }

  private checkPartialFile(node: ERBContentNode): void {
    const isPartial = isPartialFile(this.context.fileName)

    if (isPartial === false) {
      this.addOffense("Strict locals (`locals:`) only work in partials (files starting with `_`). This declaration will be ignored.", node.location)
    }
  }

  private handleValidFormat(commentContent: string, node: ERBContentNode): void {
    if (this.seenStrictLocalsComment) {
      this.addOffense(
        `Duplicate \`locals:\` declaration. Only one \`locals:\` comment is allowed per partial (first declaration at line ${this.firstStrictLocalsLocation?.line}).`,
        node.location
      )

      return
    }

    this.seenStrictLocalsComment = true
    this.firstStrictLocalsLocation = {
      line: node.location.start.line,
      column: node.location.start.column
    }

    const paramsMatch = commentContent.match(/^locals:\s*(\([\s\S]*\))\s*$/)

    if (paramsMatch) {
      const error = validateLocalsSignature(paramsMatch[1])

      if (error) {
        this.addOffense(error, node.location)
      }
    }
  }

  private handleInvalidFormat(commentContent: string, node: ERBContentNode): void {
    if (detectLocalsWithoutColon(commentContent)) {
      this.addOffense("Use `locals:` with a colon, not `locals()`. Correct format: `<%# locals: (...) %>`.", node.location)
      return
    }

    if (detectSingularLocal(commentContent)) {
      this.addOffense("Use `locals:` (plural), not `local:`.", node.location)
      return
    }

    if (detectMissingColonBeforeParens(commentContent)) {
      this.addOffense("Use `locals:` with a colon before the parentheses, not `locals (`.", node.location)
      return
    }

    if (detectMissingSpaceAfterColon(commentContent)) {
      this.addOffense("Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.", node.location)
      return
    }

    if (detectMissingParentheses(commentContent)) {
      this.addOffense("Wrap parameters in parentheses: `locals: (name:)` or `locals: (name: default)`.", node.location)
      return
    }

    if (detectEmptyLocalsWithoutParens(commentContent)) {
      this.addOffense("Add parameters after `locals:`. Use `locals: (name:)` or `locals: ()` for no locals.", node.location)
      return
    }

    this.addOffense("Invalid `locals:` syntax. Use format: `locals: (name:, option: default)`.", node.location)
  }
}

export class ERBStrictLocalsCommentSyntaxRule extends ParserRule {
  name = "erb-strict-locals-comment-syntax"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBStrictLocalsCommentSyntaxVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
