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

    this.visit(node.value)
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

  private startsWithClassLiteral(nodes: Node[]): boolean {
    return nodes.length > 0 && isLiteralNode(nodes[0]) && !!nodes[0].content.trim()
  }

  private isWhitespaceLiteral(node: Node): boolean {
    return isLiteralNode(node) && !node.content.trim()
  }

  private formatNodes(nodes: Node[], isNested: boolean): Node[] {
    const { classLiterals, others } = this.partitionNodes(nodes)
    const preserveLeadingSpace = isNested || this.startsWithClassLiteral(nodes)

    return this.formatSortedClasses(classLiterals, others, preserveLeadingSpace, isNested)
  }

  private partitionNodes(nodes: Node[]): { classLiterals: LiteralNode[], others: Node[] } {
    const classLiterals: LiteralNode[] = []
    const others: Node[] = []

    for (const node of nodes) {
      if (isLiteralNode(node)) {
        if (node.content.trim()) {
          classLiterals.push(node)
        } else {
          others.push(node)
        }
      } else {
        this.visit(node)
        others.push(node)
      }
    }

    return { classLiterals, others }
  }

  private formatSortedClasses(literals: LiteralNode[], others: Node[], preserveLeadingSpace: boolean, isNested: boolean): Node[] {
    if (literals.length === 0 && others.length === 0) return []
    if (literals.length === 0) return others

    const fullContent = literals.map(n => n.content).join("")
    const trimmedClasses = fullContent.trim()

    if (!trimmedClasses) return others.length > 0 ? others : []

    try {
      const sortedClasses = this.sorter.sortClasses(trimmedClasses)

      if (others.length === 0) {
        return this.formatSortedLiteral(literals[0], fullContent, sortedClasses, trimmedClasses)
      }

      return this.formatSortedLiteralWithERB(literals[0], fullContent, sortedClasses, others, preserveLeadingSpace, isNested)
    } catch (error) {
      return [...literals, ...others]
    }
  }

  private formatSortedLiteral(literal: LiteralNode, fullContent: string, sortedClasses: string, trimmedClasses: string): Node[] {
    const leadingSpace = fullContent.match(/^\s*/)?.[0] || ""
    const trailingSpace = fullContent.match(/\s*$/)?.[0] || ""
    const alreadySorted = sortedClasses === trimmedClasses

    const sortedContent = alreadySorted ? fullContent : (leadingSpace + sortedClasses + trailingSpace)

    asMutable(literal).content = sortedContent

    return [literal]
  }

  private formatSortedLiteralWithERB(literal: LiteralNode, fullContent: string, sortedClasses: string, others: Node[], preserveLeadingSpace: boolean, isNested: boolean): Node[] {
    const leadingSpace = fullContent.match(/^\s*/)?.[0] || ""
    const trailingSpace = fullContent.match(/\s*$/)?.[0] || ""

    const leading = preserveLeadingSpace ? leadingSpace : ""
    const firstIsWhitespace = this.isWhitespaceLiteral(others[0])
    const spaceBetween = firstIsWhitespace ? "" : " "

    asMutable(literal).content = leading + sortedClasses + spaceBetween

    const othersWithWhitespace = this.addSpacingBetweenERBNodes(others, isNested, trailingSpace)

    return [literal, ...othersWithWhitespace]
  }

  private addSpacingBetweenERBNodes(nodes: Node[], isNested: boolean, trailingSpace: string): Node[] {
    return nodes.flatMap((node, index) => {
      const isLast = index >= nodes.length - 1

      if (isLast) {
        return isNested && trailingSpace ? [node, this.spaceLiteral] : [node]
      }

      const currentIsWhitespace = this.isWhitespaceLiteral(node)
      const nextIsWhitespace = this.isWhitespaceLiteral(nodes[index + 1])
      const needsSpace = !currentIsWhitespace && !nextIsWhitespace

      return needsSpace ? [node, this.spaceLiteral] : [node]
    })
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
