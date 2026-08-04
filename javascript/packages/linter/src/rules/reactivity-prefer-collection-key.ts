import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { HTMLElementNode, HTMLAttributeNode, HTMLOpenTagNode, HTMLTextNode, ERBContentNode } from "@herb-tools/core"

import { isNode } from "@herb-tools/core"

import type { ERBIterationBlockNode, Node, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const POSITIONAL_MESSAGES = ["times", "upto", "downto", "step"]
const KEY_ATTRIBUTES = ["herb-key", "id"]
const CONSEQUENCE = "so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state."

class PreferCollectionKeyVisitor extends BaseRuleVisitor {
  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
    this.checkIterationBlock(node)

    this.visitChildNodes(node)
  }

  private checkIterationBlock(node: ERBIterationBlockNode): void {
    const message = node.message?.value

    if (!message || POSITIONAL_MESSAGES.includes(message)) return
    if (this.hasKeyDirective(node)) return

    const element = this.singleRootElement(node)

    if (!element) {
      this.addOffense(
        `Add a \`<%# herb:key ... %>\` directive to this collection, or wrap each row in a single element with a \`herb-key\` or \`id\` attribute, ${CONSEQUENCE}`,
        node.location,
      )

      return
    }

    if (this.hasKeyAttribute(element)) return

    const tagName = element.tag_name?.value ?? "element"

    this.addOffense(`Add a \`herb-key\` or \`id\` attribute to \`<${tagName}>\` ${CONSEQUENCE}`, element.location)
  }

  private hasKeyDirective(node: ERBIterationBlockNode): boolean {
    return node.body.some(child => {
      if (!isNode(child, ERBContentNode)) return false
      if (child.tag_opening?.value !== "<%#") return false

      return /^herb:key\s+\S/.test(child.content?.value?.trim() ?? "")
    })
  }

  private singleRootElement(node: ERBIterationBlockNode): HTMLElementNode | null {
    const elements = node.body.filter(child => !this.isWhitespaceOnlyText(child) && isNode(child, HTMLElementNode))

    if (elements.length !== 1) return null

    return elements[0] as HTMLElementNode
  }

  private hasKeyAttribute(element: HTMLElementNode): boolean {
    const openTag = element.open_tag

    if (!isNode(openTag, HTMLOpenTagNode)) return false

    return openTag.children.some(child => {
      if (!isNode(child, HTMLAttributeNode)) return false

      const name = child.name?.children.map(part => (part as { content?: string }).content ?? "").join("")

      return KEY_ATTRIBUTES.includes(name?.toLowerCase() ?? "")
    })
  }

  private isWhitespaceOnlyText(node: Node): boolean {
    return isNode(node, HTMLTextNode) && node.content.trim() === ""
  }
}

export class ReactivityPreferCollectionKeyRule extends ParserRule {
  static ruleName = "reactivity-prefer-collection-key"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new PreferCollectionKeyVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
