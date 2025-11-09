import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, Token, ERBNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface ERBRequireWhitespaceAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
  openTag: Token
  closeTag: Token
  content: string
  fixType: "after-open" | "before-close" | "after-comment-equals"
}

class RequireWhitespaceInsideTags extends BaseRuleVisitor<ERBRequireWhitespaceAutofixContext> {

  visitERBNode(node: ERBNode): void {
    const openTag = node.tag_opening
    const closeTag = node.tag_closing
    const content = node.content

    if (!openTag || !closeTag || !content) {
      return
    }

    const value = content.value

    if (openTag.value === "<%#") {
      this.checkCommentTagWhitespace(node, openTag, closeTag, value)
    } else {
      this.checkOpenTagWhitespace(node, openTag, closeTag, value)
      this.checkCloseTagWhitespace(node, openTag, closeTag, value)
    }
  }

  private checkCommentTagWhitespace(node: ERBNode, openTag: Token, closeTag: Token, content: string): void {
    if (!content.startsWith(" ") && !content.startsWith("\n") && !content.startsWith("=")) {
      this.addOffense(
        `Add whitespace after \`${openTag.value}\`.`,
        openTag.location,
        {
          node,
          openTag,
          closeTag,
          content,
          fixType: "after-open"
        }
      )
    } else if (content.startsWith("=") && content.length > 1 && !content[1].match(/\s/)) {
      this.addOffense(
        `Add whitespace after \`<%#=\`.`,
        openTag.location,
        {
          node,
          openTag,
          closeTag,
          content,
          fixType: "after-comment-equals"
        }
      )
    }

    if (!content.endsWith(" ") && !content.endsWith("\n")) {
      this.addOffense(
        `Add whitespace before \`${closeTag.value}\`.`,
        closeTag.location,
        {
          node,
          openTag,
          closeTag,
          content,
          fixType: "before-close"
        }
      )
    }
  }

  private checkOpenTagWhitespace(node: ERBNode, openTag: Token, closeTag: Token, content: string):void {
    if (content.startsWith(" ") || content.startsWith("\n")) {
      return
    }

    this.addOffense(
      `Add whitespace after \`${openTag.value}\`.`,
      openTag.location,
      {
        node,
        openTag,
        closeTag,
        content,
        fixType: "after-open"
      }
    )
  }

  private checkCloseTagWhitespace(node: ERBNode, openTag: Token, closeTag: Token, content: string):void {
    if (content.endsWith(" ") || content.endsWith("\n")) {
      return
    }

    this.addOffense(
      `Add whitespace before \`${closeTag.value}\`.`,
      closeTag.location,
      {
        node,
        openTag,
        closeTag,
        content,
        fixType: "before-close"
      }
    )
  }
}

export class ERBRequireWhitespaceRule extends ParserRule<ERBRequireWhitespaceAutofixContext> {
  static autocorrectable = true
  name = "erb-require-whitespace-inside-tags"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBRequireWhitespaceAutofixContext>[] {
    const visitor = new RequireWhitespaceInsideTags(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBRequireWhitespaceAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, fixType } = offense.autofixContext

    if (!node.content) return null

    const content = node.content.value

    if (fixType === "before-close") {
      node.content.value = content + " "

      return result
    }

    if (fixType === "after-open") {
      node.content.value = " " + content

      return result
    }

    if (fixType === "after-comment-equals" && content.startsWith("=")) {
      node.content.value = "= " + content.substring(1)

      return result
    }

    return null
  }
}
