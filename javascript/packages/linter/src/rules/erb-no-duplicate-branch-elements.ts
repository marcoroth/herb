import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import {
  isLiteralNode,
  isHTMLTextNode,
  isHTMLElementNode,
  isERBIfNode,
  isERBElseNode,
  isERBUnlessNode,
  isERBCaseNode,
  isERBWhenNode,
  isEquivalentElement,
} from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, Node, ERBIfNode, ERBUnlessNode, ERBCaseNode, ERBElseNode, HTMLElementNode } from "@herb-tools/core"

function isWhitespaceOnly(node: Node): boolean {
  if (isLiteralNode(node) || isHTMLTextNode(node)) {
    return /^\s*$/.test(node.content ?? "")
  }

  return false
}

function getSignificantNodes(statements: Node[]): Node[] {
  return statements.filter(node => !isWhitespaceOnly(node))
}

function allEquivalentElements(nodes: Node[]): nodes is HTMLElementNode[] {
  if (nodes.length < 2) return false
  if (!nodes.every(node => isHTMLElementNode(node))) return false

  const first = nodes[0]

  return nodes.slice(1).every(node => isEquivalentElement(first, node as HTMLElementNode))
}

function collectBranchesFromIf(node: ERBIfNode): Node[][] | null {
  const branches: Node[][] = []
  let current: ERBIfNode | ERBElseNode | null = node.subsequent

  branches.push(node.statements)

  while (current) {
    if (isERBElseNode(current)) {
      branches.push(current.statements)
      return branches
    }

    if (isERBIfNode(current)) {
      branches.push(current.statements)
      current = current.subsequent
    } else {
      break
    }
  }

  return null
}

function collectBranchesFromUnless(node: ERBUnlessNode): Node[][] | null {
  if (!node.else_clause) return null

  return [node.statements, node.else_clause.statements]
}

function collectBranchesFromCase(node: ERBCaseNode): Node[][] | null {
  if (!node.else_clause) return null

  const branches: Node[][] = []

  for (const condition of node.conditions) {
    if (isERBWhenNode(condition)) {
      branches.push(condition.statements)
    }
  }

  branches.push(node.else_clause.statements)

  return branches
}

function collectBranches(node: ERBIfNode | ERBUnlessNode | ERBCaseNode): Node[][] | null {
  if (isERBIfNode(node)) return collectBranchesFromIf(node)
  if (isERBUnlessNode(node)) return collectBranchesFromUnless(node)
  if (isERBCaseNode(node)) return collectBranchesFromCase(node)

  return null
}

function findCommonPrefixCount(branches: Node[][], minLength: number): number {
  let count = 0

  for (let index = 0; index < minLength; index++) {
    const nodesAtIndex = branches.map(branch => branch[index])

    if (allEquivalentElements(nodesAtIndex)) {
      count++
    } else {
      break
    }
  }

  return count
}

function findCommonSuffixCount(branches: Node[][], minLength: number, prefixCount: number): number {
  let count = 0

  for (let offset = 0; offset < minLength - prefixCount; offset++) {
    const nodesAtOffset = branches.map(branch => branch[branch.length - 1 - offset])

    if (allEquivalentElements(nodesAtOffset)) {
      count++
    } else {
      break
    }
  }

  return count
}

class ERBNoDuplicateBranchElementsVisitor extends BaseRuleVisitor {
  private processedIfNodes = new Set<Node>()

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.checkConditionalNode(node)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkConditionalNode(node)
    this.visitChildNodes(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.checkConditionalNode(node)
    this.visitChildNodes(node)
  }

  private checkConditionalNode(node: ERBIfNode | ERBUnlessNode | ERBCaseNode): void {
    const branches = collectBranches(node)
    if (!branches) return

    if (isERBIfNode(node)) {
      this.markSubsequentIfNodesAsProcessed(node)
    }

    this.checkBranches(branches)
  }

  private markSubsequentIfNodesAsProcessed(node: ERBIfNode): void {
    let current: ERBIfNode | ERBElseNode | null = node.subsequent

    while (current) {
      if (isERBIfNode(current)) {
        this.processedIfNodes.add(current)
        current = current.subsequent
      } else {
        break
      }
    }
  }

  private checkBranches(branches: Node[][]): void {
    const significantBranches = branches.map(getSignificantNodes)

    if (significantBranches.some(branch => branch.length === 0)) return

    const minLength = Math.min(...significantBranches.map(branch => branch.length))
    const prefixCount = findCommonPrefixCount(significantBranches, minLength)
    const suffixCount = findCommonSuffixCount(significantBranches, minLength, prefixCount)

    for (let index = 0; index < prefixCount; index++) {
      const elements = significantBranches.map(branch => branch[index] as HTMLElementNode)
      this.reportAndRecurse(elements)
    }

    for (let offset = 0; offset < suffixCount; offset++) {
      const elements = significantBranches.map(branch => branch[branch.length - 1 - offset] as HTMLElementNode)
      this.reportAndRecurse(elements)
    }
  }

  private reportAndRecurse(elements: HTMLElementNode[]): void {
    const bodies = elements.map(element => element.body)
    const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

    for (const element of elements) {
      const printed = IdentityPrinter.print(element.open_tag)

      this.addOffense(
        `The \`${printed}\` element is duplicated across all branches of this conditional and can be moved outside.`,
        bodiesMatch ? element.location : (element?.open_tag?.location || element.location),
      )
    }

    if (!bodiesMatch && bodies.every(body => body.length > 0)) {
      this.checkBranches(bodies)
    }
  }
}

export class ERBNoDuplicateBranchElementsRule extends ParserRule {
  static ruleName = "erb-no-duplicate-branch-elements"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoDuplicateBranchElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
