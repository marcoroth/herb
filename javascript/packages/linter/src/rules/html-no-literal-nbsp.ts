import { ParserRule, Mutable, BaseAutofixContext } from "../types.js"
import { BaseRuleVisitor, locationFromContentOffset } from "./rule-utils.js"
import { getTagLocalName, isNode, LiteralNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLTextNode, HTMLElementNode, HTMLAttributeValueNode } from "@herb-tools/core"

const NON_BREAKING_SPACE = "\u00A0"
const ENTITY = "&nbsp;"

const RAW_TEXT_ELEMENTS = new Set(["script", "style"])

const MESSAGE = `Use \`${ENTITY}\` instead of a literal non-breaking space (U+00A0). The literal character is invisible in an editor, so it reads as a regular space and is easily lost when the file is edited.`

interface LiteralNbspAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLTextNode> | Mutable<LiteralNode>
}

function findNonBreakingSpaceOffsets(value: string): number[] {
  const offsets: number[] = []
  let index = value.indexOf(NON_BREAKING_SPACE)

  while (index !== -1) {
    offsets.push(index)
    index = value.indexOf(NON_BREAKING_SPACE, index + 1)
  }

  return offsets
}

class HTMLNoLiteralNBSPVisitor extends BaseRuleVisitor<LiteralNbspAutofixContext> {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName) {
      this.elementStack.push(tagName)
    }

    super.visitHTMLElementNode(node)

    if (tagName) {
      this.elementStack.pop()
    }
  }

  private get insideRawTextElement(): boolean {
    return this.elementStack.some((tagName) => RAW_TEXT_ELEMENTS.has(tagName))
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    if (!this.insideRawTextElement) {
      this.reportOccurrences(node, node.content)
    }

    super.visitHTMLTextNode(node)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    for (const child of node.children) {
      if (isNode(child, LiteralNode)) {
        this.reportOccurrences(child, child.content)
      }
    }

    super.visitHTMLAttributeValueNode(node)
  }

  private reportOccurrences(node: HTMLTextNode | LiteralNode, content: string | null): void {
    if (!content) return

    for (const offset of findNonBreakingSpaceOffsets(content)) {
      const location = locationFromContentOffset(node.location.start.line, node.location.start.column, content, offset)

      this.addOffense(MESSAGE, location, { node })
    }
  }
}

export class HTMLNoLiteralNBSPRule extends ParserRule<LiteralNbspAutofixContext> {
  static autocorrectable = true
  static ruleName = "html-no-literal-nbsp"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<LiteralNbspAutofixContext>[] {
    const visitor = new HTMLNoLiteralNBSPVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<LiteralNbspAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (!node.content) return null

    node.content = node.content.replaceAll(NON_BREAKING_SPACE, ENTITY)

    return result
  }
}
