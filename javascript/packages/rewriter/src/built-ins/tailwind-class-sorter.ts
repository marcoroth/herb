import { getStaticAttributeName, isLiteralNode, isPureWhitespaceNode, splitLiteralsAtWhitespace, groupNodesByClass, isERBOpenTagNode, isHTMLAttributeNode } from "@herb-tools/core"
import { LiteralNode, Location, Visitor } from "@herb-tools/core"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import { TailwindClassSorter } from "@herb-tools/tailwind-class-sorter"
import { StringRewriter } from "../string-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"

type ClassSplice = { from: string, to: string }

import type {
  ERBBeginNode,
  ERBBlockNode,
  ERBCaseMatchNode,
  ERBCaseNode,
  ERBElseNode,
  ERBEnsureNode,
  ERBForNode,
  ERBIfNode,
  ERBInNode,
  ERBOpenTagNode,
  ERBRescueNode,
  ERBUnlessNode,
  ERBUntilNode,
  ERBWhenNode,
  ERBWhileNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLElementNode,
  Node,
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

  private isInterpolatedGroup(group: Node[]): boolean {
    return group.some(node => !isLiteralNode(node))
  }

  private isWhitespaceGroup(group: Node[]): boolean {
    return group.every(node => isPureWhitespaceNode(node))
  }

  private getStaticClassContent(group: Node[]): string {
    return group
      .filter(node => isLiteralNode(node))
      .map(node => (node as LiteralNode).content)
      .join("")
  }

  private categorizeGroups(groups: Node[][]): { staticClasses: string[], interpolationGroups: Node[][], standaloneERBNodes: Node[] } {
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

    return { staticClasses, interpolationGroups, standaloneERBNodes }
  }

  private formatNodes(nodes: Node[], isNested: boolean): Node[] {
    if (nodes.length === 0) return nodes
    if (nodes.every(child => isPureWhitespaceNode(child))) return nodes

    const splitNodes = splitLiteralsAtWhitespace(nodes)
    const groups = groupNodesByClass(splitNodes)
    const groupPrecedingWhitespace = new Map<Node[], Node[]>()
    const nodePrecedingWhitespace = new Map<Node, Node[]>()

    for (let i = 1; i < groups.length; i++) {
      if (!this.isWhitespaceGroup(groups[i]) && this.isWhitespaceGroup(groups[i - 1])) {
        groupPrecedingWhitespace.set(groups[i], groups[i - 1])

        for (const node of groups[i]) {
          if (!isLiteralNode(node)) {
            nodePrecedingWhitespace.set(node, groups[i - 1])
          }
        }
      }
    }

    let leadingWhitespace: Node[] | null = null
    let trailingWhitespace: Node[] | null = null

    if (isNested && groups.length > 0) {
      if (this.isWhitespaceGroup(groups[0])) {
        leadingWhitespace = groups[0]
      }
      if (groups.length > 1 && this.isWhitespaceGroup(groups[groups.length - 1])) {
        trailingWhitespace = groups[groups.length - 1]
      }
    }

    const { staticClasses, interpolationGroups, standaloneERBNodes } = this.categorizeGroups(groups)

    const allStaticContent = staticClasses.join(" ")
    let sortedContent = allStaticContent

    if (allStaticContent) {
      try {
        sortedContent = this.sorter.sortClasses(allStaticContent)
      } catch {
        // Keep original on error
      }
    }

    const parts: Node[] = []

    if (sortedContent) {
      parts.push(new LiteralNode({
        type: "AST_LITERAL_NODE",
        content: sortedContent,
        errors: [],
        location: Location.zero
      }))
    }

    for (const group of interpolationGroups) {
      if (parts.length > 0) {
        const whitespace = groupPrecedingWhitespace.get(group)
        parts.push(...(whitespace ?? [this.spaceLiteral]))
      }

      parts.push(...this.trimGroupWhitespace(group))
    }

    for (const node of standaloneERBNodes) {
      if (parts.length > 0) {
        const whitespace = nodePrecedingWhitespace.get(node)
        parts.push(...(whitespace ?? [this.spaceLiteral]))
      }
      parts.push(node)
    }

    if (isNested && parts.length > 0) {
      const leading = leadingWhitespace ?? [this.spaceLiteral]
      const trailing = trailingWhitespace ?? [this.spaceLiteral]
      return [...leading, ...parts, ...trailing]
    }

    return parts
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
 * Visitor that extracts class attribute splice operations from Action View Tag Helper elements.
 * Finds static class attributes and records old/new ERB tag text for string-level replacement.
 */
class ActionViewClassSorterVisitor extends Visitor {
  private sorter: TailwindClassSorter
  private splices: ClassSplice[]

  constructor(sorter: TailwindClassSorter, splices: ClassSplice[]) {
    super()

    this.sorter = sorter
    this.splices = splices
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && isERBOpenTagNode(node.open_tag)) {
      this.extractSplice(node)
    }

    this.visitChildNodes(node)
  }

  private extractSplice(node: HTMLElementNode): void {
    const openTag = node.open_tag as ERBOpenTagNode

    if (!openTag.content) return
    if (!openTag.tag_opening) return
    if (!openTag.tag_closing) return
    if (!openTag.children) return

    for (const child of openTag.children) {
      if (!isHTMLAttributeNode(child)) continue
      if (!child.name || !child.value) continue

      const attributeName = getStaticAttributeName(child.name)
      if (attributeName !== "class") continue

      const valueChildren = child.value.children
      if (!valueChildren || valueChildren.length === 0) continue

      if (!valueChildren.every(isLiteralNode)) continue

      const classValue = (valueChildren as LiteralNode[]).map(n => n.content).join("")
      if (!classValue.trim()) continue

      let sortedValue: string

      try {
        sortedValue = this.sorter.sortClasses(classValue)
      } catch {
        continue
      }

      if (sortedValue === classValue) continue

      const oldContent = openTag.content.value
      const doubleQuoted = `"${classValue}"`
      const singleQuoted = `'${classValue}'`

      let newContent: string

      if (oldContent.includes(doubleQuoted)) {
        newContent = oldContent.replace(doubleQuoted, `"${sortedValue}"`)
      } else if (oldContent.includes(singleQuoted)) {
        newContent = oldContent.replace(singleQuoted, `'${sortedValue}'`)
      } else {
        continue
      }

      const oldTag = openTag.tag_opening.value + oldContent + openTag.tag_closing.value
      const newTag = openTag.tag_opening.value + newContent + openTag.tag_closing.value

      this.splices.push({ from: oldTag, to: newTag })
    }
  }
}

/**
 * Built-in rewriter that sorts Tailwind CSS classes in class and className attributes.
 *
 * Operates as a string rewriter with two phases:
 * 1. Parse the template normally and sort HTML element class attributes via AST manipulation.
 * 2. Parse again with action_view_helpers enabled to locate and sort class attributes in
 *    Action View Tag Helper expressions (tag.div, content_tag, etc.) via string splicing.
 */
export class TailwindClassSorterRewriter extends StringRewriter {
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

  rewrite(formatted: string, _context: RewriteContext): string {
    if (!this.sorter) return formatted

    let htmlSorted: string

    try {
      const parseResult = Herb.parse(formatted, { track_whitespace: true })

      if (parseResult.failed) return formatted

      const visitor = new TailwindClassSorterVisitor(this.sorter)
      visitor.visit(parseResult.value)

      htmlSorted = IdentityPrinter.print(parseResult.value)
    } catch {
      return formatted
    }

    return this.sortActionViewHelperClasses(htmlSorted)
  }

  private sortActionViewHelperClasses(source: string): string {
    let parseResult

    try {
      parseResult = Herb.parse(source, {
        track_whitespace: true,
        action_view_helpers: true
      })
    } catch {
      return source
    }

    if (parseResult.failed) return source

    const splices: ClassSplice[] = []
    const visitor = new ActionViewClassSorterVisitor(this.sorter!, splices)

    visitor.visit(parseResult.value)

    if (splices.length === 0) return source

    let result = source

    for (const { from, to } of splices) {
      result = result.replaceAll(from, to)
    }

    return result
  }
}
