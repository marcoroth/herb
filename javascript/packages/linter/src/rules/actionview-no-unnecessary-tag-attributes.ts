import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, isHTMLOpenTagNode, isERBContentNode, isERBOutputNode, isHTMLAttributeNode, isWhitespaceNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, HTMLOpenTagNode, ParserOptions, PrismNode } from "@herb-tools/core"

function isTagAttributesCall(node: PrismNode): boolean {
  if (node?.constructor?.name !== "CallNode") return false
  if (node.name !== "attributes") return false
  if (node.receiver?.constructor?.name !== "CallNode") return false

  return node.receiver.name === "tag"
}

function hasOnlyTagAttributesChildren(openTag: HTMLOpenTagNode): boolean {
  const nonWhitespaceChildren = openTag.children.filter(child => !isWhitespaceNode(child))

  if (nonWhitespaceChildren.length === 0) return false
  if (nonWhitespaceChildren.some(isHTMLAttributeNode)) return false

  return nonWhitespaceChildren.every(child => {
    if (!isERBContentNode(child) || !isERBOutputNode(child)) return false
    if (!child.prismNode) return false

    return isTagAttributesCall(child.prismNode)
  })
}

class ActionViewNoUnnecessaryTagAttributesVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkUnnecessaryTagAttributes(node)
    super.visitHTMLElementNode(node)
  }

  private checkUnnecessaryTagAttributes(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) return

    const tagName = getTagLocalName(node.open_tag)

    if (!tagName) return
    if (!hasOnlyTagAttributesChildren(node.open_tag)) return

    this.addOffense(
      `Avoid using \`tag.attributes\` to set all attributes on \`<${tagName}>\`. Use \`tag.${tagName}\` or add the attributes directly to the \`<${tagName}>\` tag instead.`,
      node.open_tag.location,
    )
  }
}

export class ActionViewNoUnnecessaryTagAttributesRule extends ParserRule {
  static ruleName = "actionview-no-unnecessary-tag-attributes"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoUnnecessaryTagAttributesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
