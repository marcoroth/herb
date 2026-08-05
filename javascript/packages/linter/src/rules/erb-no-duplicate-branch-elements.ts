import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import {
  isHTMLElementNode,
  isHTMLOpenTagNode,
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
  allIdentical?: boolean
}

function getSignificantNodes(statements: Node[]): Node[] {
  return statements.filter(node => !isPureWhitespaceNode(node))
}

function trimWhitespaceNodes(nodes: Node[]): Node[] {
  let start = 0
  let end = nodes.length
  while (start < end && isPureWhitespaceNode(nodes[start])) start++
  while (end > start && isPureWhitespaceNode(nodes[end - 1])) end--
  return nodes.slice(start, end)
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
    element_source: template.element_source,
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

    if (this.allBranchesIdentical(branches)) {
      this.addOffense(
        "All branches of this conditional have identical content. The conditional can be removed.",
        node.location,
        { node: node as Mutable<ConditionalNode>, allIdentical: true },
        "warning",
      )

      return
    }

    const state = { isFirstOffense: true }
    this.checkBranches(branches, node, state)
  }

  private allBranchesIdentical(branches: Node[][]): boolean {
    if (branches.length < 2) return false

    const first = branches[0].map(node => IdentityPrinter.print(node)).join("")

    return branches.slice(1).every(branch =>
      branch.map(node => IdentityPrinter.print(node)).join("") === first
    )
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

      if (bodiesMatch) {
        const autofixContext = state.isFirstOffense
          ? { node: conditionalNode as Mutable<ConditionalNode> }
          : undefined

        this.addOffense(
          `The \`${printed}\` element is duplicated across all branches of this conditional and can be moved outside.`,
          element.location,
          autofixContext,
        )

        state.isFirstOffense = false
      } else {
        const autofixContext = state.isFirstOffense
          ? { node: conditionalNode as Mutable<ConditionalNode> }
          : undefined

        const tagNameLocation = isHTMLOpenTagNode(element.open_tag) && element.open_tag.tag_name?.location
          ? element.open_tag.tag_name.location
          : element?.open_tag?.location || element.location

        this.addOffense(
          `The \`${printed}\` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.`,
          tagNameLocation,
          autofixContext,
          "hint",
        )

        state.isFirstOffense = false
      }
    }

    if (!bodiesMatch && bodies.every(body => body.length > 0)) {
      this.checkBranches(bodies, conditionalNode, state)
    }
  }
}

export class ERBNoDuplicateBranchElementsRule extends ParserRule<DuplicateBranchAutofixContext> {
  static ruleName = "erb-no-duplicate-branch-elements"
  static introducedIn = this.version("0.9.0")
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

    if (offense.autofixContext.allIdentical) {
      const parentInfo = findParentArray(result.value, conditionalNode as unknown as Node)
      if (!parentInfo) return null

      const { array: parentArray, index: conditionalIndex } = parentInfo
      const firstBranchContent = trimWhitespaceNodes(branches[0])

      parentArray.splice(conditionalIndex, 1, ...firstBranchContent)

      return result
    }

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
    let didMutate = false
    let failedToHoistPrefix = false
    let hoistedBefore = false

    const hoistElement = (elements: HTMLElementNode[], position: "before" | "after"): void => {
      const actualPosition = (position === "before" && failedToHoistPrefix) ? "after" : position
      const bodiesMatch = elements.every(element => IdentityPrinter.print(element) === IdentityPrinter.print(elements[0]))

      if (bodiesMatch) {
        if (actualPosition === "after") {
          const currentLengths = branches.map(b => getSignificantNodes(b as Node[]).length)
          if (currentLengths.some(l => l !== currentLengths[0])) return
        }

        if (actualPosition === "after" && position === "before") {
          const isAtEnd = branches.every((branch, index) => {
            const nodes = getSignificantNodes(branch as Node[])

            return nodes.length > 0 && nodes[nodes.length - 1] === elements[index]
          })

          if (!isAtEnd) return
        }

        for (let i = 0; i < branches.length; i++) {
          removeNodeFromArray(branches[i] as Node[], elements[i])
        }

        if (actualPosition === "before") {
          parentArray.splice(conditionalIndex, 0, elements[0], createLiteral("\n"))
          conditionalIndex += 2
          hoistedBefore = true
        } else {
          parentArray.splice(conditionalIndex + 1, 0, createLiteral("\n"), elements[0])
        }

        didMutate = true
      } else {
        if (hasWrapped) return

        const canWrap = branches.every((branch, index) => {
          const remaining = getSignificantNodes(branch)

          return remaining.length === 1 && remaining[0] === elements[index]
        })

        if (!canWrap) {
          if (position === "before") failedToHoistPrefix = true
          return
        }

        for (let i = 0; i < branches.length; i++) {
          replaceNodeWithBody(branches[i] as Node[], elements[i])
        }

        const wrapper = createWrapper(elements[0], [createLiteral("\n"), conditionalNode as unknown as Node, createLiteral("\n")])

        parentArray[conditionalIndex] = wrapper
        parentArray = wrapper.body as Node[]
        conditionalIndex = 1
        hasWrapped = true
        didMutate = true
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

    if (!hasWrapped && hoistedBefore) {
      const remaining = branches.map(branch => getSignificantNodes(branch as Node[]))

      if (remaining.every(branch => branch.length === 1) && allEquivalentElements(remaining.map(b => b[0]))) {
        const elements = remaining.map(b => b[0] as HTMLElementNode)
        const bodiesMatch = elements.every(el => IdentityPrinter.print(el) === IdentityPrinter.print(elements[0]))

        if (!bodiesMatch && elements.every(el => el.body.length > 0)) {
          for (let i = 0; i < branches.length; i++) {
            replaceNodeWithBody(branches[i] as Node[], elements[i])
          }

          const wrapper = createWrapper(elements[0], [createLiteral("\n"), conditionalNode as unknown as Node, createLiteral("\n")])
          parentArray[conditionalIndex] = wrapper
          didMutate = true
        }
      }
    }

    return didMutate ? result : null
  }
}
