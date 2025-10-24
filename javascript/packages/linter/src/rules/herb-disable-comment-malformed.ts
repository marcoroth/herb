import { ParserRule } from "../types.js"
import { HerbDisableCommentBaseVisitor } from "./herb-disable-comment-base.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

class HerbDisableCommentMalformedVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: ERBContentNode, content: string): void {
    const looksLikeHerbDisable = content.trim().startsWith("herb:disable")
    if (!looksLikeHerbDisable) return

    const validFormat = /^\s*herb:disable\s+([a-zA-Z0-9_-]+(?:\s*,\s*[a-zA-Z0-9_-]+)*)\s*$/
    const emptyFormat = /^\s*herb:disable\s*$/

    if (validFormat.test(content)) return
    if (emptyFormat.test(content)) return

    let message = "`herb:disable` comment is malformed."

    if (content.match(/,\s*$/)) {
      message = "`herb:disable` comment has a trailing comma. Remove the trailing comma."
    } else if (content.match(/,\s*,/)) {
      message = "`herb:disable` comment has consecutive commas. Remove extra commas."
    } else if (content.match(/^\s*herb:disable\s*,/)) {
      message = "`herb:disable` comment starts with a comma. Remove the leading comma."
    }

    this.addOffense(message, node.location, "error")
  }
}

export class HerbDisableCommentMalformedRule extends ParserRule {
  name = "herb-disable-comment-malformed"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HerbDisableCommentMalformedVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
