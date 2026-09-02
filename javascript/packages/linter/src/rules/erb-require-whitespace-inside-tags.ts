import { ParserRule } from "../types.js"
import { CommentedERBTagVisitor, commentedTagPrefixesFor, respacedCommentedTag } from "../utils/commented-erb-tag-utils.js"
import { isERBEscapedNode } from "@herb-tools/core"

import type { ParseResult, Token, ERBNode } from "@herb-tools/core"
import type { CommentedERBTagAutofixContext } from "../utils/commented-erb-tag-utils.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

class RequireWhitespaceInsideTags extends CommentedERBTagVisitor {
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
    } else if (isERBEscapedNode(node) && value.startsWith("#")) {
      this.checkCloseTagWhitespace(node, openTag, closeTag, value)
    } else {
      this.checkOpenTagWhitespace(node, openTag, closeTag, value)
      this.checkCloseTagWhitespace(node, openTag, closeTag, value)
    }
  }

  private checkCommentTagWhitespace(node: ERBNode, openTag: Token, closeTag: Token, content: string): void {
    const commentedTagPrefix = this.getCommentedTagPrefix(content)

    if (commentedTagPrefix) {
      const afterPrefix = content.substring(commentedTagPrefix.length)
      const tag = `<%#${commentedTagPrefix}`

      if (afterPrefix.length > 0 && !afterPrefix[0].match(/\s/)) {
        this.addOffense(
          `Add whitespace after \`${tag}\`. This looks like a temporarily commented ERB tag.`,
          openTag.location,
          {
            node,
            openTag,
            closeTag,
            content,
            fixType: "after-comment-equals",
            unsafe: true,
          },
          "info"
        )
      }
    } else if (!content.startsWith(" ") && !content.startsWith("\n")) {
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

export class ERBRequireWhitespaceRule extends ParserRule<CommentedERBTagAutofixContext> {
  static autocorrectable = true
  static ruleName = "erb-require-whitespace-inside-tags"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<CommentedERBTagAutofixContext>[] {
    const visitor = new RequireWhitespaceInsideTags(this.ruleName, commentedTagPrefixesFor(result, context), context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<CommentedERBTagAutofixContext>, result: ParseResult, context?: Partial<LintContext>): ParseResult | null {
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

    if (fixType === "after-comment-equals") {
      const respaced = respacedCommentedTag(content, commentedTagPrefixesFor(result, context))

      if (respaced) {
        node.content.value = respaced

        return result
      }
    }

    return null
  }
}
