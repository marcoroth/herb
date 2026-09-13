import { IdentityPrinter } from "@herb-tools/printer"

import {
  getTagName,
  isERBOutputNode,
  isHTMLTextNode,
  isInlineElement,
  isLiteralNode,
  isWhitespacePreservingElement,
} from "@herb-tools/core"

import type * as Nodes from "@herb-tools/core"

const ERB_TAG_MODIFIERS = new Set(["#", "=", "-", "%"])

const BARE = /[A-Za-z0-9\-_=]/
const QUOTE = /["']/

const UNKNOWN_OUTPUT = "a"

export function erbTagContent(node: Nodes.Node): string {
  return ((node as unknown as { content?: { value?: string } }).content?.value) ?? ""
}

export function endsInLineComment(content: string): boolean {
  const line = content.slice(content.lastIndexOf("\n") + 1)
  const stack: string[] = []

  const INTERPOLATION = ""

  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    const quote = stack[stack.length - 1]

    if (quote) {
      if (character === "\\") {
        index++
      } else if (character === "#" && line[index + 1] === "{" && quote !== "'") {
        stack.push(INTERPOLATION)
        index++
      } else if (character === quote) {
        stack.pop()
      }

      continue
    }

    if (character === '"' || character === "'" || character === "`") {
      stack.push(character)
    } else if (character === "}" && stack.length > 0) {
      stack.pop()
    } else if (character === "#" && line[index + 1] !== "{") {
      return stack.length === 0
    }
  }

  return false
}

function isConditionalComment(node: Nodes.HTMLCommentNode): boolean {
  const text = node.children.map(child => (isHTMLTextNode(child) || isLiteralNode(child) ? child.content : "")).join("")

  return text.trimStart().startsWith("[if") || text.includes("<![endif]")
}

function isHerbDirective(node: Nodes.ERBCommentNode): boolean {
  return erbTagContent(node).trimStart().startsWith("herb:")
}

/**
 * Prints an HTML+ERB document with the whitespace that does not survive rendering
 * removed, and with the comments that carry no markup left out.
 */
export class MinifyPrinter extends IdentityPrinter {
  private pendingSpace = false
  private hasRenderedContent = false
  private preserveDepth = 0
  private pendingNewline = false
  private openTagDepth = 0
  private attributeDepth = 0
  private attributeNameDepth = 0
  private attributeName: string | null = null
  private printingComment = false
  private lastRendered = ""

  private emit(content: string, rendered = true): void {
    this.flushNewline()
    this.write(content)

    if (rendered && content.length > 0) {
      this.lastRendered = content[content.length - 1]
    }
  }

  private flushNewline(): void {
    if (!this.pendingNewline) return

    this.pendingNewline = false
    this.write("\n")
    this.lastRendered = "\n"
  }

  private flushSpace(): void {
    if (this.pendingSpace && this.hasRenderedContent) this.emit(" ")

    this.pendingSpace = false
  }

  private separate(alsoAfterQuote: boolean): void {
    if (BARE.test(this.lastRendered) || (alsoAfterQuote && QUOTE.test(this.lastRendered))) {
      this.emit(" ")
    }
  }

  private writeText(content: string): void {
    if (this.preserveDepth > 0) {
      this.emit(content)
      this.hasRenderedContent = true
      return
    }

    const collapsed = content.replace(/\s+/g, " ")
    const core = collapsed.trim()

    if (collapsed.startsWith(" ")) this.pendingSpace = true

    if (core === "") return

    this.flushSpace()
    this.emit(core)

    this.hasRenderedContent = true
    this.pendingSpace = collapsed.endsWith(" ")
  }

  visitHTMLTextNode(node: Nodes.HTMLTextNode): void {
    this.writeText(node.content)
  }

  visitLiteralNode(node: Nodes.LiteralNode): void {
    if (this.attributeDepth > 0) {
      if (this.attributeName === "class") {
        this.writeText(node.content)
      } else {
        this.emit(node.content)
      }

      return
    }

    if (this.openTagDepth > 0 || this.preserveDepth > 0) {
      this.emit(node.content)
      return
    }

    this.writeText(node.content)
  }

  visitWhitespaceNode(_node: Nodes.WhitespaceNode): void {
    if (this.openTagDepth > 0) return

    this.pendingSpace = true
  }

  private printElement(tagName: string, open: Nodes.Node | null, body: Nodes.Node[], close: Nodes.Node | null): void {
    const inline = isInlineElement(tagName)
    const preserve = isWhitespacePreservingElement(tagName)

    if (inline) {
      this.flushSpace()
    } else {
      this.pendingSpace = false
    }

    if (open) this.visit(open)

    if (!inline) this.hasRenderedContent = false

    if (preserve) this.preserveDepth++

    for (const child of body) this.visit(child)

    if (preserve) this.preserveDepth--

    if (!inline) this.pendingSpace = false

    if (close) this.visit(close)

    if (!inline) this.pendingSpace = false

    this.hasRenderedContent = inline
  }

  visitHTMLElementNode(node: Nodes.HTMLElementNode): void {
    this.printElement(getTagName(node) ?? "", node.open_tag, node.body, node.close_tag)
  }

  visitHTMLConditionalElementNode(node: Nodes.HTMLConditionalElementNode): void {
    this.printElement(node.tag_name?.value ?? "", node.open_conditional, node.body, node.close_conditional)
  }

  visitHTMLOpenTagNode(node: Nodes.HTMLOpenTagNode): void {
    this.emit(node.tag_opening?.value ?? "<")
    this.emit(node.tag_name?.value ?? "")

    this.openTagDepth++

    for (const child of node.children) this.visit(child)

    this.openTagDepth--

    const closing = node.tag_closing?.value ?? ">"

    if (closing.includes("/") && BARE.test(this.lastRendered)) this.emit(" ")

    this.emit(closing)
  }

  visitHTMLCloseTagNode(node: Nodes.HTMLCloseTagNode): void {
    this.emit(node.tag_opening?.value ?? "</")
    this.emit(node.tag_name?.value ?? "")
    this.emit(node.tag_closing?.value ?? ">")
  }

  visitHTMLAttributeNode(node: Nodes.HTMLAttributeNode): void {
    if (this.lastRendered !== "" && !/\s/.test(this.lastRendered)) this.emit(" ")

    const previousName = this.attributeName

    this.attributeName = node.name?.children
      ?.map(child => (isLiteralNode(child) ? child.content : ""))
      .join("")
      .toLowerCase() ?? null

    if (node.name) {
      this.attributeNameDepth++
      this.visit(node.name)
      this.attributeNameDepth--
    }

    if (node.equals) this.emit(node.equals.value.trim())
    if (node.equals && node.value) this.visit(node.value)

    this.attributeName = previousName
  }

  visitHTMLAttributeValueNode(node: Nodes.HTMLAttributeValueNode): void {
    this.attributeDepth++

    if (node.quoted) this.emit(node.open_quote?.value ?? '"')

    const previousPendingSpace = this.pendingSpace
    const previousHasRenderedContent = this.hasRenderedContent

    this.pendingSpace = false
    this.hasRenderedContent = false

    for (const child of node.children) this.visit(child)

    this.pendingSpace = previousPendingSpace
    this.hasRenderedContent = previousHasRenderedContent

    if (node.quoted) this.emit(node.close_quote?.value ?? '"')

    this.attributeDepth--
  }

  visitHTMLCommentNode(node: Nodes.HTMLCommentNode): void {
    if (!isConditionalComment(node)) return

    this.flushNewline()
    this.flushSpace()
    super.visitHTMLCommentNode(node)
    this.hasRenderedContent = true
  }

  visitERBCommentNode(node: Nodes.ERBCommentNode): void {
    if (!isHerbDirective(node)) return

    this.printingComment = true
    this.printERBNode(node)
    this.printingComment = false
  }

  visitHTMLDoctypeNode(node: Nodes.HTMLDoctypeNode): void {
    this.flushNewline()
    this.pendingSpace = false
    this.preserveDepth++
    super.visitHTMLDoctypeNode(node)
    this.preserveDepth--
  }

  visitXMLDeclarationNode(node: Nodes.XMLDeclarationNode): void {
    this.flushNewline()
    this.pendingSpace = false
    this.preserveDepth++
    super.visitXMLDeclarationNode(node)
    this.preserveDepth--
  }

  protected printERBNode(node: Nodes.ERBNode): void {
    const content = erbTagContent(node)
    const output = isERBOutputNode(node)

    if (this.attributeDepth > 0) {
      if (this.attributeName === "class") this.flushSpace()
    } else if (this.attributeNameDepth > 0) {
      // no separator inside an attribute name
    } else if (this.openTagDepth > 0) {
      this.separate(false)
    } else if (output) {
      this.flushSpace()
    }

    this.emit(node.tag_opening?.value ?? "", false)
    this.emit(this.minifyTagContent(content), false)
    this.emit(node.tag_closing?.value ?? "", false)

    if (output) {
      this.hasRenderedContent = true
      this.lastRendered = UNKNOWN_OUTPUT
    }

    this.pendingNewline = endsInLineComment(content)
  }

  private minifyTagContent(content: string): string {
    if (this.printingComment) return content
    if (content.includes("\n")) return content

    const trimmed = content.trim()

    if (trimmed === content) return content
    if (trimmed.length === 0) return trimmed
    if (ERB_TAG_MODIFIERS.has(trimmed[0])) return content
    if (ERB_TAG_MODIFIERS.has(trimmed[trimmed.length - 1])) return content

    return trimmed
  }
}
