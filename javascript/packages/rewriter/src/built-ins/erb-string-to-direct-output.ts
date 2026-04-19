import { Visitor, isERBOutputNode, createLiteral, createERBOutputNode, findParentArray, isPrismNodeType } from "@herb-tools/core"

import { ASTRewriter } from "../ast-rewriter.js"

import type { RewriteContext } from "../context.js"
import type { Node, ERBContentNode, PrismNode } from "@herb-tools/core"

const STRING_NODE_TYPE = "StringNode"
const INTERPOLATED_STRING_NODE_TYPE = "InterpolatedStringNode"
const EMBEDDED_STATEMENTS_NODE_TYPE = "EmbeddedStatementsNode"

export interface TextPart {
  type: "text"
  content: string
}

export interface ExpressionPart {
  type: "expression"
  expression: string
}

export type ReplacementPart = TextPart | ExpressionPart

class ERBStringToDirectOutputVisitor extends Visitor {
  private root: Node

  constructor(root: Node) {
    super()
    this.root = root
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (!isERBOutputNode(node)) {
      this.visitChildNodes(node)
      return
    }

    const prismNode = node.prismNode
    if (!prismNode) {
      this.visitChildNodes(node)
      return
    }

    const source = node.source
    if (!source) {
      this.visitChildNodes(node)
      return
    }

    if (!ERBStringToDirectOutputRewriter.isStringOutputNode(prismNode)) {
      this.visitChildNodes(node)
      return
    }

    const replacementParts = ERBStringToDirectOutputRewriter.extractReplacementParts(prismNode, source)

    if (!replacementParts) {
      this.visitChildNodes(node)
      return
    }

    const tagOpening = node.tag_opening?.value ?? "<%="
    const tagClosing = node.tag_closing?.value ?? "%>"

    const parentInfo = findParentArray(this.root, node)

    if (!parentInfo) {
      this.visitChildNodes(node)
      return
    }

    const { array: parentArray, index: nodeIndex } = parentInfo
    const replacementNodes: Node[] = []

    for (const part of replacementParts) {
      if (part.type === "text") {
        replacementNodes.push(createLiteral(part.content))
      } else {
        replacementNodes.push(createERBOutputNode(` ${part.expression.trim()} `, tagOpening, tagClosing))
      }
    }

    parentArray.splice(nodeIndex, 1, ...replacementNodes)
  }
}

export class ERBStringToDirectOutputRewriter extends ASTRewriter {
  get name(): string {
    return "erb-string-to-direct-output"
  }

  get description(): string {
    return "Replaces ERB string output with direct text and expression tags"
  }

  rewrite<T extends Node>(node: T, _context: RewriteContext): T {
    const visitor = new ERBStringToDirectOutputVisitor(node)

    visitor.visit(node)

    return node
  }

  static isStringOutputNode(prismNode: PrismNode): boolean {
    return isPrismNodeType(prismNode, STRING_NODE_TYPE) || isPrismNodeType(prismNode, INTERPOLATED_STRING_NODE_TYPE)
  }

  static extractStringContent(stringNode: PrismNode, source: string): string {
    const unescapedValue = stringNode.unescaped?.value

    if (typeof unescapedValue === "string") {
      return unescapedValue
    }

    const location = stringNode.contentLoc

    if (location) {
      return source.substring(location.startOffset, location.startOffset + location.length)
    }

    return ""
  }

  static extractExpressionSource(embeddedNode: PrismNode, source: string): string | null {
    const openingLocation = embeddedNode.openingLoc
    const closingLocation = embeddedNode.closingLoc

    if (!openingLocation || !closingLocation) return null

    const expressionStart = openingLocation.startOffset + openingLocation.length
    const expressionEnd = closingLocation.startOffset

    return source.substring(expressionStart, expressionEnd)
  }

  static extractReplacementParts(prismNode: PrismNode, source: string): ReplacementPart[] | null {
    if (isPrismNodeType(prismNode, STRING_NODE_TYPE)) {
      const textContent = this.extractStringContent(prismNode, source)
      return [{ type: "text", content: textContent }]
    }

    if (isPrismNodeType(prismNode, INTERPOLATED_STRING_NODE_TYPE)) {
      const parts = prismNode.parts

      if (!parts || parts.length === 0) return null

      const replacementParts: ReplacementPart[] = []

      for (const part of parts) {
        if (isPrismNodeType(part, STRING_NODE_TYPE)) {
          const textContent = this.extractStringContent(part, source)

          if (textContent) {
            replacementParts.push({ type: "text", content: textContent })
          }
        } else if (isPrismNodeType(part, EMBEDDED_STATEMENTS_NODE_TYPE)) {
          const expression = this.extractExpressionSource(part, source)

          if (expression) {
            replacementParts.push({ type: "expression", expression })
          }
        }
      }

      return replacementParts.length > 0 ? replacementParts : null
    }

    return null
  }
}
