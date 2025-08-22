import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { filterERBContentNodes } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNameNode, ERBContentNode } from "@herb-tools/core"

class ERBNoSilentTagInAttributeNameVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    const erbNodes = filterERBContentNodes(node.children)
    const silentNodes = erbNodes.filter(this.isSilentERBTag)

    for (const node of silentNodes) {
      this.addOffense(
        `Remove silent ERB tag from HTML attribute name. Silent ERB tags (\`${node.tag_opening?.value}\`) do not output content and should not be used in attribute names.`,
        node.location,
        "error"
      )
    }
  }

  // TODO: might be worth to extract
  private isSilentERBTag(node: ERBContentNode): boolean {
    const silentTags = ["<%", "<%-", "<%#"]

    return silentTags.includes(node.tag_opening?.value || "")
  }
}

export class ERBNoSilentTagInAttributeNameRule extends ParserRule {
  name = "erb-no-silent-tag-in-attribute-name"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBNoSilentTagInAttributeNameVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
