import { Visitor } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node"

import { getAttributes, getAttributeName, getStaticAttributeValue, getTagName, getTokenList } from "@herb-tools/core"
import { nodeToRange, lspRangeFromLocation, erbTagToRange } from "./range_utils"

import type { Range } from "vscode-languageserver/node"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { DocumentNode, ERBContentNode, ERBNode, ERBRenderNode, HTMLAttributeNode, HTMLElementNode, Node } from "@herb-tools/core"

const PARSER_OPTIONS = { render_nodes: true, action_view_helpers: true } as const
const UNNAMED_ELEMENT = "element"
const QUOTE = /^["']|["']$/g
const SEMANTIC_CLASS_LIMIT = 2
const ERB_LABEL_LIMIT = 32

class DocumentSymbolCollector extends Visitor {
  readonly symbols: DocumentSymbol[] = []

  private stack: DocumentSymbol[][] = [this.symbols]
  private attributes = 0

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.nest(this.symbolFor(this.elementName(node), SymbolKind.Field, nodeToRange(node), this.tagNameRange(node)), node)
  }

  visitERBRenderNode(node: ERBRenderNode): void {
    this.nest(this.symbolFor(this.renderName(node), SymbolKind.Module, nodeToRange(node), null), node)
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const name = getAttributeName(node)

    if (!name) return

    this.attributes += 1

    this.nest(this.symbolFor(`[${name}]`, SymbolKind.Property, nodeToRange(node), this.rangeOf(node.name)), node)

    this.attributes -= 1
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (this.attributes === 0) {
      this.visitChildNodes(node)

      return
    }

    this.nest(this.symbolFor(this.erbLabel(node), SymbolKind.Variable, nodeToRange(node), erbTagToRange(node)), node)
  }

  visitERBIfNode(node: ERBNode): void { this.control(node) }
  visitERBUnlessNode(node: ERBNode): void { this.control(node) }
  visitERBElseNode(node: ERBNode): void { this.control(node) }
  visitERBCaseNode(node: ERBNode): void { this.control(node) }
  visitERBCaseMatchNode(node: ERBNode): void { this.control(node) }
  visitERBWhenNode(node: ERBNode): void { this.control(node) }
  visitERBInNode(node: ERBNode): void { this.control(node) }
  visitERBBlockNode(node: ERBNode): void { this.control(node) }
  visitERBIterationBlockNode(node: ERBNode): void { this.control(node) }
  visitERBForNode(node: ERBNode): void { this.control(node) }
  visitERBWhileNode(node: ERBNode): void { this.control(node) }
  visitERBUntilNode(node: ERBNode): void { this.control(node) }
  visitERBBeginNode(node: ERBNode): void { this.control(node) }
  visitERBRescueNode(node: ERBNode): void { this.control(node) }
  visitERBEnsureNode(node: ERBNode): void { this.control(node) }

  private control(node: ERBNode): void {
    const name = this.erbLabel(node)

    if (!name) {
      this.visitChildNodes(node)

      return
    }

    const symbol = this.symbolFor(name, SymbolKind.Namespace, nodeToRange(node), erbTagToRange(node))
    const subsequent = (node as { subsequent?: Node | null }).subsequent ?? null

    this.stack.at(-1)!.push(symbol)
    this.stack.push(symbol.children!)

    for (const child of node.childNodes()) {
      if (child && child !== subsequent) this.visit(child)
    }

    this.stack.pop()

    if (subsequent) this.visit(subsequent)
  }

  private nest(symbol: DocumentSymbol, node: Node): void {
    this.stack.at(-1)!.push(symbol)
    this.stack.push(symbol.children!)

    this.visitChildNodes(node)

    this.stack.pop()
  }

  private symbolFor(name: string, kind: SymbolKind, range: Range, selectionRange: Range | null): DocumentSymbol {
    return { name, kind, range, selectionRange: selectionRange ?? range, children: [] }
  }

  private erbLabel(node: ERBNode): string {
    const content = (node.content?.value ?? "").trim()

    return content.length > ERB_LABEL_LIMIT ? `${content.slice(0, ERB_LABEL_LIMIT)}…` : content
  }

  private rangeOf(node: Node | null): Range | null {
    return node ? nodeToRange(node) : null
  }

  private tagNameRange(node: HTMLElementNode): Range | null {
    const location = node.open_tag?.tag_name?.location

    return location ? lspRangeFromLocation(location) : null
  }

  private elementName(node: HTMLElementNode): string {
    const tag = getTagName(node) || UNNAMED_ELEMENT
    const id = getStaticAttributeValue(node, "id")
    const classes = this.classNames(node)
    return `${tag}${id ? `#${id}` : ""}${classes.map(name => `.${name}`).join("")}`
  }

  private classNames(node: HTMLElementNode): string[] {
    const attribute = getAttributes(node).find(candidate => getAttributeName(candidate) === "class")

    if (!attribute) return []

    const classes = getTokenList(getStaticAttributeValue(attribute))

    return classes.length > SEMANTIC_CLASS_LIMIT ? [] : classes
  }

  private renderName(node: ERBRenderNode): string {
    const rendered = node.keywords?.partial ?? node.keywords?.layout ?? node.keywords?.template_path

    if (!rendered) return "render"

    return `render ${rendered.value.replace(QUOTE, "")}`
  }
}

export class DocumentSymbolProvider {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getDocumentSymbols(document: TextDocument): DocumentSymbol[] {
    const result = this.parserService.parseContent(document.getText(), PARSER_OPTIONS)
    const collector = new DocumentSymbolCollector()

    collector.visit(result.value as DocumentNode)

    return collector.symbols
  }
}
