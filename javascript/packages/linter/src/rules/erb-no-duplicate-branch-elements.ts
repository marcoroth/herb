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
  HTMLElementNode,
  LiteralNode,
  Location,
} from "@herb-tools/core"

import type { BaseAutofixContext, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, Node, ERBIfNode, ERBUnlessNode, ERBCaseNode, ERBElseNode } from "@herb-tools/core"
import type { Mutable } from "@herb-tools/rewriter"

type ConditionalNode = ERBIfNode | ERBUnlessNode | ERBCaseNode

interface DuplicateBranchAutofixContext extends BaseAutofixContext {
  node: Mutable<ConditionalNode>
}

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

function findConditionalParentArray(root: Node, target: Node): { array: Node[], index: number } | null {
  const ARRAY_PROPS = ['children', 'body', 'statements', 'conditions']
  const LINKED_PROPS = ['subsequent', 'else_clause']

  const search = (node: Node): { array: Node[], index: number } | null => {
    const nodeRecord = node as any

    for (const prop of ARRAY_PROPS) {
      const array = nodeRecord[prop]
      if (Array.isArray(array)) {
        const index = array.indexOf(target)
        if (index !== -1) {
          return { array, index }
        }
      }
    }

    for (const prop of ARRAY_PROPS) {
      const array = nodeRecord[prop]
      if (Array.isArray(array)) {
        for (const child of array) {
          if (child && typeof child === 'object' && 'type' in child) {
            const result = search(child)
            if (result) return result
          }
        }
      }
    }

    for (const prop of LINKED_PROPS) {
      const value = nodeRecord[prop]
      if (value && typeof value === 'object' && 'type' in value) {
        const result = search(value)
        if (result) return result
      }
    }

    return null
  }

  return search(root)
}

function removeNodeFromArray(array: Node[], node: Node): void {
  const index = array.indexOf(node)
  if (index === -1) return

  if (index > 0 && isWhitespaceOnly(array[index - 1])) {
    array.splice(index - 1, 2)
  } else {
    array.splice(index, 1)
  }
}

function replaceNodeWithBody(array: Node[], element: HTMLElementNode): void {
  const index = array.indexOf(element)
  if (index === -1) return
  array.splice(index, 1, ...element.body)
}

function createLiteral(content: string): LiteralNode {
  return new LiteralNode({
    type: "AST_LITERAL_NODE",
    content,
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

    const parentInfo = findConditionalParentArray(result.value, conditionalNode as unknown as Node)
    if (!parentInfo) return null

    let { array: parentArray, index: conditionalIndex } = parentInfo
    let hasWrapped = false

    // Process prefix elements (in order)
    for (let index = 0; index < prefixCount; index++) {
      const elements = significantBranches.map(branch => branch[index] as HTMLElementNode)
      const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

      if (bodiesMatch) {
        for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
          removeNodeFromArray(branches[branchIndex] as Node[], elements[branchIndex])
        }
        parentArray.splice(conditionalIndex, 0, elements[0])
        conditionalIndex++
      } else {
        if (hasWrapped) continue

        for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
          replaceNodeWithBody(branches[branchIndex] as Node[], elements[branchIndex])
        }

        const templateJson = elements[0].toJSON()
        templateJson.body = []
        const wrapper = HTMLElementNode.from(templateJson) as unknown as Record<string, any>
        wrapper.body = [createLiteral("\n"), conditionalNode as unknown as Node, createLiteral("\n")]

        parentArray[conditionalIndex] = wrapper as unknown as Node
        parentArray = wrapper.body as Node[]
        conditionalIndex = 1
        hasWrapped = true
      }
    }

    // Process suffix elements (in reverse order)
    for (let index = 0; index < suffixCount; index++) {
      const elements = significantBranches.map(branch => branch[branch.length - 1 - index] as HTMLElementNode)
      const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

      if (bodiesMatch) {
        for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
          removeNodeFromArray(branches[branchIndex] as Node[], elements[branchIndex])
        }
        parentArray.splice(conditionalIndex + 1, 0, elements[0])
      } else {
        if (hasWrapped) continue

        for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
          replaceNodeWithBody(branches[branchIndex] as Node[], elements[branchIndex])
        }

        const templateJson = elements[0].toJSON()
        templateJson.body = []
        const wrapper = HTMLElementNode.from(templateJson) as unknown as Record<string, any>
        wrapper.body = [createLiteral("\n"), conditionalNode as unknown as Node, createLiteral("\n")]

        parentArray[conditionalIndex] = wrapper as unknown as Node
        parentArray = wrapper.body as Node[]
        conditionalIndex = 1
        hasWrapped = true
      }
    }

    return result
  }
}
