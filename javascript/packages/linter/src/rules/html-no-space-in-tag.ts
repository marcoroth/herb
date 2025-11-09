import { Token, Location, WhitespaceNode } from "@herb-tools/core"
import { ParserRule, BaseAutofixContext } from "../types.js"

import { findParent, BaseRuleVisitor } from "./rule-utils.js"
import { filterWhitespaceNodes, isWhitespaceNode, isHTMLOpenTagNode } from "@herb-tools/core"

import type { ParseResult, Node, HTMLCloseTagNode, HTMLOpenTagNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, Mutable, FullRuleConfig } from "../types.js"

const MESSAGES = {
  EXTRA_SPACE_NO_SPACE: "Extra space detected where there should be no space.",
  EXTRA_SPACE_SINGLE_SPACE: "Extra space detected where there should be a single space.",
  EXTRA_SPACE_SINGLE_BREAK: "Extra space detected where there should be a single space or a single line break.",
  NO_SPACE_SINGLE_SPACE: "No space detected where there should be a single space.",
} as const

interface HTMLNoSpaceInTagAutofixContext extends BaseAutofixContext {
  node: WhitespaceNode | HTMLOpenTagNode
  message: string
}

class HTMLNoSpaceInTagVisitor extends BaseRuleVisitor<HTMLNoSpaceInTagAutofixContext> {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.isSingleLine) {
      this.checkSingleLineTag(node)
    } else {
      this.checkMultilineTag(node)
    }
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.reportAllWhitespace(node.children, MESSAGES.EXTRA_SPACE_NO_SPACE)
  }

  private checkSingleLineTag(node: HTMLOpenTagNode): void {
    const { children, tag_closing } = node
    const isSelfClosing = tag_closing ? this.isSelfClosing(tag_closing) : false

    this.checkWhitespaceInSingleLineTag(children, isSelfClosing)
    this.checkMissingSpaceBeforeSelfClosing(node, children, isSelfClosing)
  }

  private checkWhitespaceInSingleLineTag(children: Node[], isSelfClosing: boolean): void {
    const whitespaceNodes = filterWhitespaceNodes(children)

    whitespaceNodes.forEach((whitespace) => {
      const content = this.getWhitespaceContent(whitespace)
      if (!content) return

      const isLastChild = children[children.length - 1] === whitespace
      if (isLastChild) {
        this.checkTrailingWhitespace(whitespace, content, isSelfClosing)
        return
      }

      if (content.length > 1) {
        this.addOffense(MESSAGES.EXTRA_SPACE_SINGLE_SPACE, whitespace.location, { node: whitespace, message: MESSAGES.EXTRA_SPACE_SINGLE_SPACE })
      }
    })
  }

  private checkTrailingWhitespace(whitespace: WhitespaceNode, content: string, isSelfClosing: boolean): void {
    if (isSelfClosing && content === ' ') return

    this.addOffense(MESSAGES.EXTRA_SPACE_NO_SPACE, whitespace.location, { node: whitespace, message: MESSAGES.EXTRA_SPACE_NO_SPACE })
  }

  private checkMissingSpaceBeforeSelfClosing(node: HTMLOpenTagNode, children: Node[], isSelfClosing: boolean): void {
    if (!isSelfClosing) return

    const lastChild = children[children.length - 1]
    if (lastChild && isWhitespaceNode(lastChild)) return

    const lastNonWhitespace = children.filter(child => !isWhitespaceNode(child)).pop()
    const locationToReport = lastNonWhitespace?.location ?? node.tag_name?.location ?? node.location

    this.addOffense(MESSAGES.NO_SPACE_SINGLE_SPACE, locationToReport, { node, message: MESSAGES.NO_SPACE_SINGLE_SPACE })
  }

  private checkMultilineTag(node: HTMLOpenTagNode): void {
    const whitespaceNodes = filterWhitespaceNodes(node.children)
    let previousWhitespace: WhitespaceNode | null = null

    whitespaceNodes.forEach((whitespace, index) => {
      const content = this.getWhitespaceContent(whitespace)
      if (!content) return

      if (this.hasConsecutiveNewlines(content, previousWhitespace)) {
        this.addOffense(MESSAGES.EXTRA_SPACE_SINGLE_BREAK, whitespace.location, { node: whitespace, message: MESSAGES.EXTRA_SPACE_SINGLE_BREAK })
        previousWhitespace = whitespace

        return
      }

      if (this.isNonNewlineWhitespace(content)) {
        this.checkIndentation(whitespace, index, whitespaceNodes.length, node)
      }

      previousWhitespace = whitespace
    })
  }

  private hasConsecutiveNewlines(content: string, previousWhitespace: WhitespaceNode | null): boolean {
    if (content === "\n") return previousWhitespace?.value?.value === "\n"
    if (!content.includes("\n")) return false

    const newlines = content.match(/\n/g)

    return (newlines?.length ?? 0) > 1
  }

  private isNonNewlineWhitespace(content: string): boolean {
    return !content.includes("\n")
  }

  private checkIndentation(whitespace: WhitespaceNode, index: number, totalWhitespaceNodes: number, node: HTMLOpenTagNode): void {
    const isLastWhitespace = index === totalWhitespaceNodes - 1
    const expectedIndent = isLastWhitespace ? node.location.start.column : node.location.start.column + 2

    if (whitespace.location.end.column === expectedIndent) return

    this.addOffense(MESSAGES.EXTRA_SPACE_NO_SPACE, whitespace.location, { node: whitespace, message: MESSAGES.EXTRA_SPACE_NO_SPACE })
  }

  private isSelfClosing(tag_closing: Token): boolean {
    return tag_closing?.value?.includes('/') ?? false
  }

  private getWhitespaceContent(whitespace: WhitespaceNode): string | null {
    return whitespace.value?.value ?? null
  }

  private reportAllWhitespace(nodes: Node[] | WhitespaceNode[], message: string): void {
    const whitespaceNodes = Array.isArray(nodes) && nodes.length > 0 && !isWhitespaceNode(nodes[0])
      ? filterWhitespaceNodes(nodes)
      : nodes as WhitespaceNode[]

    whitespaceNodes.forEach(whitespace => {
      this.addOffense(message, whitespace.location, { node: whitespace, message })
    })
  }
}

export class HTMLNoSpaceInTagRule extends ParserRule<HTMLNoSpaceInTagAutofixContext> {
  // TODO: enable and fix autofix
  static autocorrectable = false
  name = "html-no-space-in-tag"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<HTMLNoSpaceInTagAutofixContext>[] {
    const visitor = new HTMLNoSpaceInTagVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<HTMLNoSpaceInTagAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, message } = offense.autofixContext
    if (!node) return null

    if (isHTMLOpenTagNode(node)) {
      const token = Token.from({ type: "TOKEN_WHITESPACE", value: " ", range: [0, 0], location: Location.zero })
      const whitespace = new WhitespaceNode({ type: "AST_WHITESPACE_NODE", value: token, location: Location.zero, errors: [] })

      node.children.push(whitespace)

      return result
    }

    if (!isWhitespaceNode(node)) return null

    const whitespaceNode = node as Mutable<WhitespaceNode>
    if (!whitespaceNode.value) return null

    switch (message) {
      case MESSAGES.EXTRA_SPACE_NO_SPACE: {
        let selfClosing = false
        let beginningOfLine = false

        const parent = findParent(result.value, node)

        if (parent && isHTMLOpenTagNode(parent)) {
          selfClosing = parent.tag_closing?.value === "/>"
          beginningOfLine = node.location.start.column === 0
        }

        whitespaceNode.value.value = selfClosing && !beginningOfLine ? " " : ""

        return result
      }

      case MESSAGES.EXTRA_SPACE_SINGLE_BREAK: {
        if (whitespaceNode.value.value.includes("\n")) {
          whitespaceNode.value.value = ""
        } else {
          whitespaceNode.value.value = " "
        }

        return result
      }

      case MESSAGES.EXTRA_SPACE_SINGLE_SPACE:
      case MESSAGES.NO_SPACE_SINGLE_SPACE: {
        whitespaceNode.value.value = " "

        return result
      }

      default: return null
    }
  }
}
