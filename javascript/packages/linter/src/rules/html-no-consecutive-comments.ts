import { isCommentNode } from "@herb-tools/core"
import { BaseRuleVisitor, isWhitespaceOnly } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isHerbDisableContent } from "../herb-disable-comment-utils.js"
import { isHerbLinterIgnoreComment } from "../linter-ignore.js"

import type { ParseResult, DocumentNode, HTMLElementNode, Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

// TODO: https://github.com/marcoroth/herb/issues/1204
const MAX_CONSECUTIVE = 2

class ConsecutiveCommentsVisitor extends BaseRuleVisitor {
  private checkChildrenForConsecutiveComments(children: Node[]): void {
    let consecutiveComments: Node[] = []

    for (const child of children) {
      if (this.isCountableComment(child)) {
        consecutiveComments.push(child)
      } else if (isWhitespaceOnly(child)) {
        continue
      } else {
        this.reportIfExcessive(consecutiveComments)
        consecutiveComments = []
      }
    }

    this.reportIfExcessive(consecutiveComments)
  }

  private isCountableComment(node: Node): boolean {
    if (!isCommentNode(node)) return false
    if (isHerbLinterIgnoreComment(node)) return false

    const content = (node as any).content?.value || ""
    const trimmed = content.trim()

    if (isHerbDisableContent(trimmed)) return false
    if (trimmed.startsWith("herb:enable")) return false

    return true
  }

  private reportIfExcessive(comments: Node[]): void {
    if (comments.length > MAX_CONSECUTIVE) {
      this.addOffense(
        `${comments.length} consecutive comments can be condensed into fewer comments.`,
        comments[0].location
      )
    }
  }

  visitDocumentNode(node: DocumentNode): void {
    this.checkChildrenForConsecutiveComments(node.children)
    super.visitDocumentNode(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkChildrenForConsecutiveComments(node.body)
    super.visitHTMLElementNode(node)
  }
}

export class HTMLNoConsecutiveCommentsRule extends ParserRule {
  name = "html-no-consecutive-comments"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ConsecutiveCommentsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
