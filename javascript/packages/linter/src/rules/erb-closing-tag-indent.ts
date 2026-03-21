import type { ERBNode, ParseResult } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface ClosingErbTagIndentAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
  fixType: "remove-newline" | "add-newline" | "fix-indent"
  expectedIndent: number
}

class ClosingErbTagIndentVisitor extends BaseRuleVisitor<ClosingErbTagIndentAutofixContext> {
  visitERBNode(node: ERBNode): void {
    const openTag = node.tag_opening
    const closeTag = node.tag_closing
    const content = node.content
    if (!openTag || !closeTag || !content) return

    const value = content.value
    if (!value.length) return

    const startsWithNewline = value.startsWith("\n")
    const endsWithNewline = this.endsWithNewline(value)

    if (!startsWithNewline && endsWithNewline) {
      this.addOffense(
        `Remove newline before \`${closeTag.value}\`. The opening \`${openTag.value}\` is not followed by a newline, so the closing tag should be on the same line.`,
        closeTag.location,
        { node, fixType: "remove-newline", expectedIndent: 0 }
      )
    } else if (startsWithNewline && !endsWithNewline) {
      const expectedIndent = openTag.location.start.column

      this.addOffense(
        `Add newline before \`${closeTag.value}\`. The opening \`${openTag.value}\` is followed by a newline, so the closing tag should be on its own line.`,
        closeTag.location,
        { node, fixType: "add-newline", expectedIndent }
      )
    } else if (startsWithNewline && endsWithNewline) {
      const expectedIndent = openTag.location.start.column
      const actualIndent = this.trailingIndent(value)
      if (actualIndent === expectedIndent) return

      this.addOffense(
        `Incorrect indentation for \`${closeTag.value}\`. Expected ${expectedIndent} ${expectedIndent === 1 ? "space" : "spaces"} but found ${actualIndent}.`,
        closeTag.location,
        { node, fixType: "fix-indent", expectedIndent }
      )
    }
  }

  private endsWithNewline(value: string): boolean {
    const lastNewlineIndex = value.lastIndexOf("\n")
    if (lastNewlineIndex === -1) return false

    const afterLastNewline = value.substring(lastNewlineIndex + 1)
    return afterLastNewline.length === 0 || /^\s*$/.test(afterLastNewline)
  }

  private trailingIndent(value: string): number {
    const lastNewlineIndex = value.lastIndexOf("\n")
    if (lastNewlineIndex === -1) return 0

    return value.length - lastNewlineIndex - 1
  }
}

export class ERBClosingTagIndentRule extends ParserRule<ClosingErbTagIndentAutofixContext> {
  static autocorrectable = true
  static reindentAfterAutofix = true
  static ruleName = "erb-closing-tag-indent"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ClosingErbTagIndentAutofixContext>[] {
    const visitor = new ClosingErbTagIndentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ClosingErbTagIndentAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, fixType, expectedIndent } = offense.autofixContext
    if (!node.content) return null

    const content = node.content.value

    switch (fixType) {
      case "add-newline": {
        const trimmed = content.trimEnd()
        node.content.value = trimmed + "\n" + " ".repeat(expectedIndent)

        return result
      }
      case "remove-newline": {
        const lastNewlineIndex = content.lastIndexOf("\n")
        if (lastNewlineIndex === -1) return null

        const beforeNewline = content.substring(0, lastNewlineIndex).trimEnd()
        node.content.value = beforeNewline + " "

        return result
      }
      case "fix-indent": {
        const lastNewlineIndex = content.lastIndexOf("\n")
        if (lastNewlineIndex === -1) return null

        node.content.value = content.substring(0, lastNewlineIndex + 1) + " ".repeat(expectedIndent)

        return result
      }
    }
  }
}
