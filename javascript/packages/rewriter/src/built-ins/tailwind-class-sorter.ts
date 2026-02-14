import { getStaticAttributeName, isLiteralNode } from "@herb-tools/core"
import { LiteralNode, Location, Visitor } from "@herb-tools/core"

import { TailwindClassSorter } from "@herb-tools/tailwind-class-sorter"
import { ASTRewriter } from "../ast-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"
import type {
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  Node,
  ERBIfNode,
  ERBUnlessNode,
  ERBElseNode,
  ERBBlockNode,
  ERBForNode,
  ERBCaseNode,
  ERBWhenNode,
  ERBCaseMatchNode,
  ERBInNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBBeginNode,
  ERBRescueNode,
  ERBEnsureNode
} from "@herb-tools/core"

/**
 * Visitor that traverses the AST and sorts Tailwind CSS classes in class attributes.
 */
class TailwindClassSorterVisitor extends Visitor {
  private sorter: TailwindClassSorter

  constructor(sorter: TailwindClassSorter) {
    super()

    this.sorter = sorter
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    if (!node.name) return
    if (!node.value) return

    const attributeName = getStaticAttributeName(node.name)
    if (attributeName !== "class") return

    const classAttributeSorter = new ClassAttributeSorter(this.sorter)

    classAttributeSorter.visit(node.value)
  }
}

/**
 * Visitor that sorts classes within a single class attribute value.
 * Only operates on the content of a class attribute, not the full document.
 */
class ClassAttributeSorter extends Visitor {
  private sorter: TailwindClassSorter

  constructor(sorter: TailwindClassSorter) {
    super()

    this.sorter = sorter
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    asMutable(node).children = this.formatNodes(node.children, false)
  }

  visitERBIfNode(node: ERBIfNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)

    this.visit(node.subsequent)
  }

  visitERBElseNode(node: ERBElseNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)

    this.visit(node.else_clause)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    asMutable(node).body = this.formatNodes(node.body, true)
  }

  visitERBForNode(node: ERBForNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.visitAll(node.children)
    this.visit(node.else_clause)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.visitAll(node.children)
    this.visit(node.else_clause)
  }

  visitERBInNode(node: ERBInNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
    this.visit(node.rescue_clause)
    this.visit(node.else_clause)
    this.visit(node.ensure_clause)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
    this.visit(node.subsequent)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    asMutable(node).statements = this.formatNodes(node.statements, true)
  }

  private get spaceLiteral(): LiteralNode {
    return new LiteralNode({
      type: "AST_LITERAL_NODE",
      content: " ",
      errors: [],
      location: Location.zero
    })
  }

  private isWhitespaceLiteral(node: Node): boolean {
    return isLiteralNode(node) && !node.content.trim()
  }

  private splitLiteralsAtWhitespace(nodes: Node[]): Node[] {
    const result: Node[] = []

    for (const node of nodes) {
      if (isLiteralNode(node)) {
        const parts = node.content.match(/(\S+|\s+)/g) || []

        for (const part of parts) {
          result.push(new LiteralNode({
            type: "AST_LITERAL_NODE",
            content: part,
            errors: [],
            location: node.location
          }))
        }
      } else {
        result.push(node)
      }
    }

    return result
  }

  private groupNodesByClass(nodes: Node[]): Node[][] {
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

  private isInterpolatedGroup(group: Node[]): boolean {
    return group.some(node => !isLiteralNode(node))
  }

  private isWhitespaceGroup(group: Node[]): boolean {
    return group.every(node => this.isWhitespaceLiteral(node))
  }

  private getStaticClassContent(group: Node[]): string {
    return group
      .filter(node => isLiteralNode(node))
      .map(node => (node as LiteralNode).content)
      .join("")
  }

  private formatNodes(nodes: Node[], isNested: boolean): Node[] {
    if (nodes.length === 0) return nodes
    if (nodes.every(n => this.isWhitespaceLiteral(n))) return nodes

    const splitNodes = this.splitLiteralsAtWhitespace(nodes)
    const groups = this.groupNodesByClass(splitNodes)

    const staticClasses: string[] = []
    const interpolationGroups: Node[][] = []
    const standaloneERBNodes: Node[] = []

    for (const group of groups) {
      if (this.isWhitespaceGroup(group)) {
        continue
      }

      if (this.isInterpolatedGroup(group)) {
        const hasAttachedLiteral = group.some(node => isLiteralNode(node) && node.content.trim())

        if (hasAttachedLiteral) {
          for (const node of group) {
            if (!isLiteralNode(node)) {
              this.visit(node)
            }
          }

          interpolationGroups.push(group)
        } else {
          for (const node of group) {
            if (!isLiteralNode(node)) {
              this.visit(node)
              standaloneERBNodes.push(node)
            }
          }
        }
      } else {
        const content = this.getStaticClassContent(group).trim()

        if (content) {
          staticClasses.push(content)
        }
      }
    }

    const allStaticContent = staticClasses.join(" ")
    let sortedContent = allStaticContent

    if (allStaticContent) {
      try {
        sortedContent = this.sorter.sortClasses(allStaticContent)
      } catch {
        // Keep original on error
      }
    }

    let addedLeadingSpace = false

    const result: Node[] = []
    const hasContent = sortedContent || interpolationGroups.length > 0 || standaloneERBNodes.length > 0
    const needsLeadingSpace = isNested && hasContent

    if (sortedContent) {
      const literal = new LiteralNode({
        type: "AST_LITERAL_NODE",
        content: (needsLeadingSpace ? " " : "") + sortedContent,
        errors: [],
        location: Location.zero
      })

      result.push(literal)

      addedLeadingSpace = !!needsLeadingSpace
    }

    for (const group of interpolationGroups) {
      if (result.length > 0) {
        result.push(this.spaceLiteral)
      } else if (needsLeadingSpace && !addedLeadingSpace) {
        result.push(this.spaceLiteral)
        addedLeadingSpace = true
      }

      const trimmedGroup = this.trimGroupWhitespace(group)

      result.push(...trimmedGroup)
    }

    for (const node of standaloneERBNodes) {
      if (result.length > 0) {
        result.push(this.spaceLiteral)
      } else if (needsLeadingSpace && !addedLeadingSpace) {
        result.push(this.spaceLiteral)
        addedLeadingSpace = true
      }
      result.push(node)
    }

    if (isNested && result.length > 0) {
      result.push(this.spaceLiteral)
    }

    return result
  }

  private trimGroupWhitespace(group: Node[]): Node[] {
    if (group.length === 0) return group

    const result = [...group]

    if (isLiteralNode(result[0])) {
      const first = result[0] as LiteralNode
      const trimmed = first.content.trimStart()

      if (trimmed !== first.content) {
        result[0] = new LiteralNode({
          type: "AST_LITERAL_NODE",
          content: trimmed,
          errors: [],
          location: first.location
        })
      }
    }

    const lastIndex = result.length - 1

    if (isLiteralNode(result[lastIndex])) {
      const last = result[lastIndex] as LiteralNode
      const trimmed = last.content.trimEnd()

      if (trimmed !== last.content) {
        result[lastIndex] = new LiteralNode({
          type: "AST_LITERAL_NODE",
          content: trimmed,
          errors: [],
          location: last.location
        })
      }
    }

    return result
  }

}

/**
 * Built-in rewriter that sorts Tailwind CSS classes in class and className attributes
 */
export class TailwindClassSorterRewriter extends ASTRewriter {
  private sorter?: TailwindClassSorter

  get name(): string {
    return "tailwind-class-sorter"
  }

  get description(): string {
    return "Sorts Tailwind CSS classes in class and className attributes according to the recommended class order"
  }

  async initialize(context: RewriteContext): Promise<void> {
    try {
      this.sorter = await TailwindClassSorter.fromConfig({
        baseDir: context.baseDir
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('Cannot find module') || errorMessage.includes('ENOENT')) {
        throw new Error(
          `Tailwind CSS is not installed in this project. ` +
          `To use the Tailwind class sorter, install Tailwind CSS itself using: npm install -D tailwindcss, ` +
          `or remove the "tailwind-class-sorter" rewriter from your .herb.yml config file.\n` +
          `If "tailwindcss" is already part of your package.json, make sure your NPM dependencies are installed.\n` +
          `Original error: ${errorMessage}.`
        )
      }

      throw error
    }
  }

  rewrite<T extends Node>(node: T, _context: RewriteContext): T {
    if (!this.sorter) {
      return node
    }

    const visitor = new TailwindClassSorterVisitor(this.sorter)

    visitor.visit(node)

    return node
  }
}
