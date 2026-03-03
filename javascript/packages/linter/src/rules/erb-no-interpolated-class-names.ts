import { isLiteralNode } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import { ParserRule } from "../types.js"
import { AttributeVisitorMixin } from "./rule-utils.js"

import type { Node } from "@herb-tools/core"
import type { StaticAttributeDynamicValueParams } from "./rule-utils.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

function isWhitespaceLiteral(node: Node): boolean {
  return isLiteralNode(node) && !node.content.trim()
}

function splitLiteralsAtWhitespace(nodes: Node[]): Node[] {
  const result: Node[] = []

  for (const node of nodes) {
    if (isLiteralNode(node)) {
      const parts = node.content.match(/(\S+|\s+)/g) || []

      for (const part of parts) {
        result.push({ ...node, content: part } as LiteralNode)
      }
    } else {
      result.push(node)
    }
  }

  return result
}

function groupNodesByClass(nodes: Node[]): Node[][] {
  if (nodes.length === 0) return []

  const groups: Node[][] = []
  let currentGroup: Node[] = []

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const previousNode = i > 0 ? nodes[i - 1] : null

    let startNewGroup = false

    if (currentGroup.length === 0) {
      startNewGroup = false
    } else if (isLiteralNode(node)) {
      if (/^\s/.test(node.content)) {
        startNewGroup = true
      } else if (/^-/.test(node.content)) {
        startNewGroup = false
      } else if (previousNode && !isLiteralNode(previousNode)) {
        startNewGroup = true
      } else if (currentGroup.every(member => isWhitespaceLiteral(member))) {
        startNewGroup = true
      }
    } else {
      if (previousNode && isLiteralNode(previousNode)) {
        if (/\s$/.test(previousNode.content)) {
          startNewGroup = true
        } else if (/-$/.test(previousNode.content)) {
          startNewGroup = false
        } else {
          startNewGroup = true
        }
      } else if (previousNode && !isLiteralNode(previousNode)) {
        startNewGroup = false
      }
    }

    if (startNewGroup && currentGroup.length > 0) {
      groups.push(currentGroup)
      currentGroup = []
    }

    currentGroup.push(node)
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

function groupToString(group: Node[]): string {
  return group.map(node => {
    if (isLiteralNode(node)) {
      return node.content
    }

    return IdentityPrinter.print(node, { ignoreErrors: true })
  }).join("")
}

class ERBNoInterpolatedClassNamesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode }: StaticAttributeDynamicValueParams) {
    if (attributeName !== "class") return

    const splitNodes = splitLiteralsAtWhitespace(valueNodes)
    const groups = groupNodesByClass(splitNodes)

    for (const group of groups) {
      if (group.every(node => isWhitespaceLiteral(node))) continue

      const isInterpolated = group.some(node => !isLiteralNode(node))
      if (!isInterpolated) continue

      const hasAttachedLiteral = group.some(node => isLiteralNode(node) && node.content.trim())
      if (!hasAttachedLiteral) continue

      const className = groupToString(group)

      this.addOffense(
        `Avoid ERB interpolation inside class names: \`${className}\`. Use standalone ERB expressions that output complete class names instead.`,
        attributeNode.value!.location,
      )
    }
  }
}

export class ERBNoInterpolatedClassNamesRule extends ParserRule {
  static ruleName = "erb-no-interpolated-class-names"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoInterpolatedClassNamesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
