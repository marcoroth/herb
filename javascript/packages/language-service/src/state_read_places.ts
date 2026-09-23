import { Position } from "vscode-languageserver-types"

import { Visitor, substringFromByteOffset } from "@herb-tools/core"
import { bareReadName, classifyDerivedDefault } from "@herb-tools/client/directives"

import { isPositionInRange, lspRangeFromLocation, hasSourceLocation } from "./range_utils"

import type { DocumentNode, Node, ERBNode, PrismNode } from "@herb-tools/core"

export type StateReadPlace =
  | { where: "client", expression: string }
  | { where: "server", expression: string }
  | { where: "unresolvable", expression: string, context: "condition" | "value" }

const OUTPUT_OPENINGS = new Set(["<%=", "<%=="])
const CONDITION_KEYWORD = /^\s*(?:if|elsif|unless|case)\s+/

export class StateReadClassifier {
  private readonly nodes: ERBNode[]

  constructor(document: DocumentNode, private readonly source: string, private readonly declared: ReadonlyMap<string, string>) {
    const collector = new ERBTagCollector()

    collector.visit(document)

    this.nodes = collector.nodes
  }

  classify(position: Position, byteOffset: number): StateReadPlace | null {
    const node = this.nodes.find(candidate => isPositionInRange(position, lspRangeFromLocation(candidate.content!.location)))

    if (!node) return null

    const content = node.content!.value

    switch (node.type) {
      case "AST_ERB_CONTENT_NODE": {
        if (!OUTPUT_OPENINGS.has(node.tag_opening?.value ?? "")) return null

        const prism = (node as { prismNode?: PrismNode }).prismNode

        return prism ? this.classifyValue(prism, byteOffset) : this.place(content.trim())
      }

      case "AST_ERB_IF_NODE":
      case "AST_ERB_UNLESS_NODE":
      case "AST_ERB_CASE_NODE": {
        const condition = content.replace(CONDITION_KEYWORD, "").trim()

        return this.evaluable(condition) ? { where: "client", expression: condition } : { where: "unresolvable", expression: condition, context: "condition" }
      }

      case "AST_ERB_BLOCK_NODE":
        return { where: "server", expression: content.replace(/\s+do\s*(\|[^|]*\|)?\s*$/, "").trim() }

      default:
        return null
    }
  }

  private classifyValue(node: PrismNode, byteOffset: number): StateReadPlace {
    const expression = this.slice(node)

    if (this.evaluable(expression)) return { where: "client", expression }

    const type = node.constructor?.name

    if ((type === "ParenthesesNode" || type === "StatementsNode") && this.single(node)) {
      return this.classifyValue(this.single(node)!, byteOffset)
    }

    if (type === "IfNode" || type === "UnlessNode" || type === "ElseNode") {
      if (node.predicate && this.covers(node.predicate, byteOffset)) {
        const condition = this.slice(node.predicate)

        return this.evaluable(condition) ? { where: "client", expression: condition } : { where: "unresolvable", expression: condition, context: "condition" }
      }

      for (const branch of [node.statements, node.subsequent, node.elseClause]) {
        if (branch && this.covers(branch, byteOffset)) return this.classifyValue(branch, byteOffset)
      }
    }

    return { where: "server", expression }
  }

  private place(expression: string): StateReadPlace {
    return this.evaluable(expression) ? { where: "client", expression } : { where: "server", expression }
  }

  private evaluable(expression: string): boolean {
    const bare = bareReadName(expression)

    if (bare !== null && this.declared.has(bare)) return true

    const derived = classifyDerivedDefault(expression, this.declared)

    return derived !== null && typeof derived === "object"
  }

  private single(node: PrismNode): PrismNode | null {
    const statements = node.constructor?.name === "StatementsNode" ? node.body : node.body?.body

    return Array.isArray(statements) && statements.length === 1 ? statements[0] : null
  }

  private covers(node: PrismNode, byteOffset: number): boolean {
    const start = node.location.startOffset

    return byteOffset >= start && byteOffset <= start + node.location.length
  }

  private slice(node: PrismNode): string {
    return substringFromByteOffset(this.source, node.location.startOffset, node.location.length).trim()
  }
}

class ERBTagCollector extends Visitor {
  readonly nodes: ERBNode[] = []

  visitChildNodes(node: Node): void {
    const content = (node as ERBNode).content

    if (node.type.startsWith("AST_ERB_") && content && hasSourceLocation(content.location)) {
      this.nodes.push(node as ERBNode)
    }

    super.visitChildNodes(node)
  }
}
