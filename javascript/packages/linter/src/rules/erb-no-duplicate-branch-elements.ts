import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import {
  isHTMLElementNode,
  isERBIfNode,
  isERBElseNode,
  isERBUnlessNode,
  isERBCaseNode,
  isERBWhenNode,
  isEquivalentElement,
  isPureWhitespaceNode,
  findParentArray,
  removeNodeFromArray,
  replaceNodeWithBody,
  createLiteral,
  HTMLElementNode,
  Location,
} from "@herb-tools/core"

import type { BaseAutofixContext, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, Node, ERBIfNode, ERBUnlessNode, ERBCaseNode, ERBElseNode } from "@herb-tools/core"
import type { Mutable } from "@herb-tools/rewriter"

type ConditionalNode = ERBIfNode | ERBUnlessNode | ERBCaseNode

interface DuplicateBranchAutofixContext extends BaseAutofixContext {
  node: Mutable<ConditionalNode>
}

function getSignificantNodes(statements: Node[]): Node[] {
  return statements.filter(node => !isPureWhitespaceNode(node))
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

function collectBranches(node: ConditionalNode): Node[][] | null {
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

function createWrapper(template: HTMLElementNode, body: Node[]): HTMLElementNode {
  return new HTMLElementNode({
    type: "AST_HTML_ELEMENT_NODE",
    open_tag: template.open_tag,
    tag_name: template.tag_name,
    body,
    close_tag: template.close_tag,
    is_void: template.is_void,
    source: template.source,
    location: Location.zero,
    errors: [],
  })
}

class ERBNoDuplicateBranchElementsVisitor extends BaseRuleVisitor<DuplicateBranchAutofixContext> {
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

  private checkConditionalNode(node: ConditionalNode): void {
    const branches = collectBranches(node)
    if (!branches) return

    if (isERBIfNode(node)) {
      this.markSubsequentIfNodesAsProcessed(node)
    }

    const state = { isFirstOffense: true }
    this.checkBranches(branches, node, state)
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

  private checkBranches(branches: Node[][], conditionalNode: ConditionalNode, state: { isFirstOffense: boolean }): void {
    const significantBranches = branches.map(getSignificantNodes)
    if (significantBranches.some(branch => branch.length === 0)) return

    const minLength = Math.min(...significantBranches.map(branch => branch.length))
    const prefixCount = findCommonPrefixCount(significantBranches, minLength)
    const suffixCount = findCommonSuffixCount(significantBranches, minLength, prefixCount)

    for (let index = 0; index < prefixCount; index++) {
      const elements = significantBranches.map(branch => branch[index] as HTMLElementNode)
      this.reportAndRecurse(elements, conditionalNode, state)
    }

    for (let offset = 0; offset < suffixCount; offset++) {
      const elements = significantBranches.map(branch => branch[branch.length - 1 - offset] as HTMLElementNode)
      this.reportAndRecurse(elements, conditionalNode, state)
    }
  }

  private reportAndRecurse(elements: HTMLElementNode[], conditionalNode: ConditionalNode, state: { isFirstOffense: boolean }): void {
    const bodies = elements.map(element => element.body)
    const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

    for (const element of elements) {
      const printed = IdentityPrinter.print(element.open_tag)
      const autofixContext = state.isFirstOffense
        ? { node: conditionalNode as Mutable<ConditionalNode> }
        : undefined

      this.addOffense(
        `The \`${printed}\` element is duplicated across all branches of this conditional and can be moved outside.`,
        bodiesMatch ? element.location : (element?.open_tag?.location || element.location),
        autofixContext,
      )

      state.isFirstOffense = false
    }

    if (!bodiesMatch && bodies.every(body => body.length > 0)) {
      this.checkBranches(bodies, conditionalNode, state)
    }
  }
}

export class ERBNoDuplicateBranchElementsRule extends ParserRule<DuplicateBranchAutofixContext> {
  static ruleName = "erb-no-duplicate-branch-elements"
  static autocorrectable = true
  static reindentAfterAutofix = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<DuplicateBranchAutofixContext>[] {
    const visitor = new ERBNoDuplicateBranchElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<DuplicateBranchAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const conditionalNode = offense.autofixContext.node
    const branches = collectBranches(conditionalNode as ConditionalNode)
    if (!branches) return null

    const significantBranches = branches.map(getSignificantNodes)
    if (significantBranches.some(branch => branch.length === 0)) return null

    const minLength = Math.min(...significantBranches.map(branch => branch.length))
    const prefixCount = findCommonPrefixCount(significantBranches, minLength)
    const suffixCount = findCommonSuffixCount(significantBranches, minLength, prefixCount)

    if (prefixCount === 0 && suffixCount === 0) return null

    const parentInfo = findParentArray(result.value, conditionalNode as unknown as Node)
    if (!parentInfo) return null

    let { array: parentArray, index: conditionalIndex } = parentInfo
    let hasWrapped = false

    const hoistElement = (elements: HTMLElementNode[], position: "before" | "after"): void => {
      const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

      if (bodiesMatch) {
        for (let i = 0; i < branches.length; i++) {
          removeNodeFromArray(branches[i] as Node[], elements[i])
        }

        if (position === "before") {
          parentArray.splice(conditionalIndex, 0, elements[0])
          conditionalIndex++
        } else {
          parentArray.splice(conditionalIndex + 1, 0, elements[0])
        }
      } else {
        if (hasWrapped) return

        for (let i = 0; i < branches.length; i++) {
          replaceNodeWithBody(branches[i] as Node[], elements[i])
        }

        const wrapper = createWrapper(elements[0], [createLiteral("\n"), conditionalNode as unknown as Node, createLiteral("\n")])

        parentArray[conditionalIndex] = wrapper
        parentArray = wrapper.body as Node[]
        conditionalIndex = 1
        hasWrapped = true
      }
    }

    for (let index = 0; index < prefixCount; index++) {
      const elements = significantBranches.map(branch => branch[index] as HTMLElementNode)
      hoistElement(elements, "before")
    }

    for (let offset = 0; offset < suffixCount; offset++) {
      const elements = significantBranches.map(branch => branch[branch.length - 1 - offset] as HTMLElementNode)
      hoistElement(elements, "after")
    }

    return result
  }
}
