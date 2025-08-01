import { Visitor } from "@herb-tools/core"

import {
  Node,
  DocumentNode,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLSelfCloseTagNode,
  HTMLElementNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLAttributeNameNode,
  HTMLTextNode,
  HTMLCommentNode,
  HTMLDoctypeNode,
  LiteralNode,
  WhitespaceNode,
  ERBContentNode,
  ERBBlockNode,
  ERBEndNode,
  ERBElseNode,
  ERBIfNode,
  ERBWhenNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBForNode,
  ERBRescueNode,
  ERBEnsureNode,
  ERBBeginNode,
  ERBUnlessNode,
  ERBYieldNode,
  ERBInNode,
  Token
} from "@herb-tools/core"

type ERBNode =
  ERBContentNode
| ERBBlockNode
| ERBEndNode
| ERBElseNode
| ERBIfNode
| ERBWhenNode
| ERBCaseNode
| ERBCaseMatchNode
| ERBWhileNode
| ERBUntilNode
| ERBForNode
| ERBRescueNode
| ERBEnsureNode
| ERBBeginNode
| ERBUnlessNode
| ERBYieldNode
| ERBInNode


import type { FormatOptions } from "./options.js"

/**
 * Printer traverses the Herb AST using the Visitor pattern
 * and emits a formatted string with proper indentation, line breaks, and attribute wrapping.
 */
export class Printer extends Visitor {
  private indentWidth: number
  private maxLineLength: number
  private source: string
  private lines: string[] = []
  private indentLevel: number = 0
  private inlineMode: boolean = false
  private isInComplexNesting: boolean = false

  constructor(source: string, options: Required<FormatOptions>) {
    super()

    this.source = source
    this.indentWidth = options.indentWidth
    this.maxLineLength = options.maxLineLength
  }

  print(object: Node | Token, indentLevel: number = 0): string {
    if (object instanceof Token || (object as any).type?.startsWith('TOKEN_')) {
      return (object as Token).value
    }

    const node: Node = object

    this.lines = []
    this.indentLevel = indentLevel
    this.isInComplexNesting = false // Reset for each top-level element

    if (typeof (node as any).accept === 'function') {
      node.accept(this)
    } else {
      this.visit(node)
    }

    return this.lines.join("\n")
  }

  private push(line: string) {
    this.lines.push(line)
  }

  private withIndent<T>(callback: () => T): T {
    this.indentLevel++
    const result = callback()
    this.indentLevel--

    return result
  }

  private indent(): string {
    return " ".repeat(this.indentLevel * this.indentWidth)
  }

  /**
   * Format ERB content with proper spacing around the inner content.
   * Returns empty string if content is empty, otherwise wraps content with single spaces.
   */
  private formatERBContent(content: string): string {
    return content.trim() ? ` ${content.trim()} ` : ""
  }

  /**
   * Print an ERB tag (<% %> or <%= %>) with single spaces around inner content.
   */
  private printERBNode(node: ERBNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const content = node.content?.value ?? ""
    const inner = this.formatERBContent(content)

    this.push(indent + open + inner + close)
  }

  // --- Visitor methods ---

  visitDocumentNode(node: DocumentNode): void {
    let lastWasMeaningful = false
    let hasHandledSpacing = false

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]

      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textNode = child as HTMLTextNode
        const isWhitespaceOnly = textNode.content.trim() === ""

        if (isWhitespaceOnly) {
          const hasPrevNonWhitespace = i > 0 && this.isNonWhitespaceNode(node.children[i - 1])
          const hasNextNonWhitespace = i < node.children.length - 1 && this.isNonWhitespaceNode(node.children[i + 1])

          const hasMultipleNewlines = textNode.content.includes('\n\n')

          if (hasPrevNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
            this.push("")
            hasHandledSpacing = true
          }

          continue
        }
      }

      if (this.isNonWhitespaceNode(child) && lastWasMeaningful && !hasHandledSpacing) {
        this.push("")
      }

      this.visit(child)

      if (this.isNonWhitespaceNode(child)) {
        lastWasMeaningful = true
        hasHandledSpacing = false
      }
    }
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const open = node.open_tag as HTMLOpenTagNode
    const tagName = open.tag_name?.value ?? ""
    const indent = this.indent()

    const attributes = open.children.filter((child): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )

    const inlineNodes = open.children.filter(child =>
      !(child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') &&
      !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')
    )

    const children = node.body.filter(
      child =>
        !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
        !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
    )

    const hasClosing = open.tag_closing?.value === ">" || open.tag_closing?.value === "/>"
    const isSelfClosing = open.tag_closing?.value === "/>"

    if (!hasClosing) {
      this.push(indent + `<${tagName}`)

      return
    }

    if (attributes.length === 0 && inlineNodes.length === 0) {
      if (children.length === 0) {
        if (isSelfClosing) {
          this.push(indent + `<${tagName} />`)
        } else if (node.is_void) {
          this.push(indent + `<${tagName}>`)
        } else {
          this.push(indent + `<${tagName}></${tagName}>`)
        }

        return
      }

      if (children.length >= 1) {
        if (this.isInComplexNesting) {
          if (children.length === 1) {
            const child = children[0]

            if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
              const textContent = (child as HTMLTextNode).content.trim()
              const singleLine = `<${tagName}>${textContent}</${tagName}>`

              if (!textContent.includes('\n') && (indent.length + singleLine.length) <= this.maxLineLength) {
                this.push(indent + singleLine)
                return
              }
            }
          }
        } else {
          const inlineResult = this.tryRenderInline(children, tagName)

          if (inlineResult && (indent.length + inlineResult.length) <= this.maxLineLength) {
            this.push(indent + inlineResult)
            return
          }
        }
      }

      this.push(indent + `<${tagName}>`)

      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      if (!node.is_void && !isSelfClosing) {
        this.push(indent + `</${tagName}>`)
      }

      return
    }

    if (attributes.length === 0 && inlineNodes.length > 0) {
      const inline = this.renderInlineOpen(tagName, [], isSelfClosing, inlineNodes, open.children)

      if (children.length === 0) {
        if (isSelfClosing || node.is_void) {
          this.push(indent + inline)
        } else {
          this.push(indent + inline + `</${tagName}>`)
        }
        return
      }

      this.push(indent + inline)
      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      if (!node.is_void && !isSelfClosing) {
        this.push(indent + `</${tagName}>`)
      }

      return
    }

    const inline = this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, open.children)
    const singleAttribute = attributes[0]
    const hasEmptyValue =
      singleAttribute &&
      (singleAttribute.value instanceof HTMLAttributeValueNode || (singleAttribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE') &&
      (singleAttribute.value as any)?.children.length === 0

    const hasERBControlFlow = inlineNodes.some(node =>
      node instanceof ERBIfNode || (node as any).type === 'AST_ERB_IF_NODE' ||
      node instanceof ERBUnlessNode || (node as any).type === 'AST_ERB_UNLESS_NODE' ||
      node instanceof ERBBlockNode || (node as any).type === 'AST_ERB_BLOCK_NODE' ||
      node instanceof ERBCaseNode || (node as any).type === 'AST_ERB_CASE_NODE' ||
      node instanceof ERBWhileNode || (node as any).type === 'AST_ERB_WHILE_NODE' ||
      node instanceof ERBForNode || (node as any).type === 'AST_ERB_FOR_NODE'
    )

    const shouldKeepInline = (attributes.length <= 3 &&
                            inline.length + indent.length <= this.maxLineLength) ||
                            (inlineNodes.length > 0 && !hasERBControlFlow)

    if (shouldKeepInline) {
      if (children.length === 0) {
        if (isSelfClosing) {
          this.push(indent + inline)
        } else if (node.is_void) {
          this.push(indent + inline)
        } else {
          let result = `<${tagName}`

          if (attributes.length > 0) {
            result += ` ${attributes.map(attr => this.renderAttribute(attr)).join(" ")}`
          }

          if (inlineNodes.length > 0) {
            const currentIndentLevel = this.indentLevel
            this.indentLevel = 0
            const tempLines = this.lines
            this.lines = []

            inlineNodes.forEach(node => {
              const wasInlineMode = this.inlineMode
              this.inlineMode = true
              this.visit(node)
              this.inlineMode = wasInlineMode
            })

            const inlineContent = this.lines.join("")
            this.lines = tempLines
            this.indentLevel = currentIndentLevel

            result += inlineContent
          }

          result += `></${tagName}>`
          this.push(indent + result)
        }

        return
      }

      if (isSelfClosing) {
        this.push(indent + inline.replace(' />', '>'))
      } else {
        this.push(indent + inline)
      }

      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      if (!node.is_void && !isSelfClosing) {
        this.push(indent + `</${tagName}>`)
      }

      return
    }

    if (inlineNodes.length > 0 && hasERBControlFlow) {
      this.push(indent + `<${tagName}`)
      this.withIndent(() => {
        open.children.forEach(child => {
          if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
            this.push(this.indent() + this.renderAttribute(child as HTMLAttributeNode))
          } else if (!(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')) {
            this.visit(child)
          }
        })
      })

      if (isSelfClosing) {
        this.push(indent + "/>")
      } else if (node.is_void) {
        this.push(indent + ">")
      } else if (children.length === 0) {
        this.push(indent + ">" + `</${tagName}>`)
      } else {
        this.push(indent + ">")
        this.withIndent(() => {
          children.forEach(child => this.visit(child))
        })
        this.push(indent + `</${tagName}>`)
      }
    } else if (inlineNodes.length > 0) {
      this.push(indent + this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, open.children))

      if (!isSelfClosing && !node.is_void && children.length > 0) {
        this.withIndent(() => {
          children.forEach(child => this.visit(child))
        })
        this.push(indent + `</${tagName}>`)
      }
    } else {
      this.push(indent + `<${tagName}`)
      this.withIndent(() => {
        attributes.forEach(attribute => {
          this.push(this.indent() + this.renderAttribute(attribute))
        })
      })

      if (isSelfClosing) {
        this.push(indent + "/>")
      } else if (node.is_void) {
        this.push(indent + ">")
      } else if (children.length === 0) {
        this.push(indent + ">" + `</${tagName}>`)
      } else {
        this.push(indent + ">")

        this.withIndent(() => {
          children.forEach(child => this.visit(child))
        })

        this.push(indent + `</${tagName}>`)
      }
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent()
    const attributes = node.children.filter((attribute): attribute is HTMLAttributeNode =>
      attribute instanceof HTMLAttributeNode || (attribute as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )

    const hasClosing = node.tag_closing?.value === ">"

    if (!hasClosing) {
      this.push(indent + `<${tagName}`)
      return
    }

    const inline = this.renderInlineOpen(tagName, attributes, node.is_void)

    if (attributes.length === 0 || inline.length + indent.length <= this.maxLineLength) {
      this.push(indent + inline)

      return
    }

    this.push(indent + `<${tagName}`)
    this.withIndent(() => {
      attributes.forEach(attribute => {
        this.push(this.indent() + this.renderAttribute(attribute))
      })
    })
    this.push(indent + (node.is_void ? "/>" : ">"))
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent()
    const attributes = node.attributes.filter((attribute): attribute is HTMLAttributeNode =>
      attribute instanceof HTMLAttributeNode || (attribute as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
    const inline = this.renderInlineOpen(tagName, attributes, true)

    const singleAttribute = attributes[0]
    const hasEmptyValue =
      singleAttribute &&
      (singleAttribute.value instanceof HTMLAttributeValueNode || (singleAttribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE') &&
      (singleAttribute.value as any)?.children.length === 0

    const shouldKeepInline = attributes.length <= 3 &&
                            inline.length + indent.length <= this.maxLineLength

    if (shouldKeepInline) {
      this.push(indent + inline)
      return
    }

    this.push(indent + `<${tagName}`)
    this.withIndent(() => {
      attributes.forEach(attribute => {
        this.push(this.indent() + this.renderAttribute(attribute))
      })
    })
    this.push(indent + "/>")
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const name = node.tag_name?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + name + close)
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    const indent = this.indent()
    let text = node.content.trim()

    if (!text) return

    const wrapWidth = this.maxLineLength - indent.length
    const words = text.split(/\s+/)
    const lines: string[] = []

    let line = ""

    for (const word of words) {
      if ((line + (line ? " " : "") + word).length > wrapWidth && line) {
        lines.push(indent + line)
        line = word
      } else {
        line += (line ? " " : "") + word
      }
    }

    if (line) lines.push(indent + line)

    lines.forEach(line => this.push(line))
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const indent = this.indent()
    this.push(indent + this.renderAttribute(node))
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    const indent = this.indent()
    const name = node.name?.value ?? ""
    this.push(indent + name)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    const indent = this.indent()
    const open_quote = node.open_quote?.value ?? ""
    const close_quote = node.close_quote?.value ?? ""
    const attribute_value = node.children.map(child => {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE' ||
          child instanceof LiteralNode || (child as any).type === 'AST_LITERAL_NODE') {
        return (child as HTMLTextNode | LiteralNode).content
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        const erbChild = child as ERBContentNode
        return (erbChild.tag_opening!.value + erbChild.content!.value + erbChild.tag_closing!.value)
      }
      return ""
    }).join("")
    this.push(indent + open_quote + attribute_value + close_quote)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    const indent = this.indent()
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""
    let inner: string

    if (node.comment_start && node.comment_end) {
      // TODO: use .value
      const [_, startIndex] = node.comment_start.range.toArray()
      const [endIndex] = node.comment_end.range.toArray()
      const rawInner = this.source.slice(startIndex, endIndex)
      inner = ` ${rawInner.trim()} `
    } else {
      inner = node.children.map(child => {
        const prevLines = this.lines.length
        this.visit(child)
        return this.lines.slice(prevLines).join("")
      }).join("")
    }

    this.push(indent + open + inner + close)
  }

  visitERBCommentNode(node: ERBContentNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    let inner: string

    if (node.tag_opening && node.tag_closing) {
      const [, openingEnd] = node.tag_opening.range.toArray()
      const [closingStart] = node.tag_closing.range.toArray()
      const rawInner = this.source.slice(openingEnd, closingStart)
      const lines = rawInner.split("\n")
      if (lines.length > 2) {
        const childIndent = indent + " ".repeat(this.indentWidth)
        const innerLines = lines.slice(1, -1).map(line => childIndent + line.trim())
        inner = "\n" + innerLines.join("\n") + "\n"
      } else {
        inner = ` ${rawInner.trim()} `
      }
    } else {
      inner = (node as any).children
        .map((child: any) => {
          const prevLines = this.lines.length
          this.visit(child)
          return this.lines.slice(prevLines).join("")
        })
        .join("")
    }

    this.push(indent + open + inner + close)
  }

  visitHTMLDoctypeNode(node: HTMLDoctypeNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    let innerDoctype: string

    if (node.tag_opening && node.tag_closing) {
      // TODO: use .value
      const [, openingEnd] = node.tag_opening.range.toArray()
      const [closingStart] = node.tag_closing.range.toArray()
      innerDoctype = this.source.slice(openingEnd, closingStart)
    } else {
      innerDoctype = node.children
        .map(child =>
          child instanceof HTMLTextNode ? child.content : (() => { const prevLines = this.lines.length; this.visit(child); return this.lines.slice(prevLines).join("") })(),
        )
        .join("")
    }

    const close = node.tag_closing?.value ?? ""
    this.push(indent + open + innerDoctype + close)
  }

  visitERBContentNode(node: ERBContentNode): void {
    // TODO: this feels hacky
    if (node.tag_opening?.value === "<%#") {
      this.visitERBCommentNode(node)
    } else {
      this.printERBNode(node)
    }
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.printERBNode(node)
  }

  visitERBYieldNode(node: ERBYieldNode): void {
    this.printERBNode(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.printERBNode(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.printERBNode(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.body.forEach(child => this.visit(child))
    })

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBIfNode(node: ERBIfNode): void {
    if (this.inlineMode) {
      const open = node.tag_opening?.value ?? ""
      const content = node.content?.value ?? ""
      const close = node.tag_closing?.value ?? ""

      const inner = this.formatERBContent(content)
      this.lines.push(open + inner + close)

      if (node.statements.length > 0) {
        this.lines.push(" ")
      }

      node.statements.forEach((child, index) => {
        if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
          this.lines.push(this.renderAttribute(child as HTMLAttributeNode))
        } else {
          this.visit(child)
        }

        if (index < node.statements.length - 1) {
          this.lines.push(" ")
        }
      })

      if (node.statements.length > 0) {
        this.lines.push(" ")
      }

      if (node.subsequent) {
        this.visit(node.subsequent)
      }

      if (node.end_node) {
        const endNode = node.end_node as any
        const endOpen = endNode.tag_opening?.value ?? ""
        const endContent = endNode.content?.value ?? ""
        const endClose = endNode.tag_closing?.value ?? ""

        const endInner = this.formatERBContent(endContent)
        this.lines.push(endOpen + endInner + endClose)
      }
    } else {
      this.printERBNode(node)

      this.withIndent(() => {
        node.statements.forEach(child => this.visit(child))
      })

      if (node.subsequent) {
        this.visit(node.subsequent)
      }

      if (node.end_node) {
        this.printERBNode(node.end_node as any)
      }
    }
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(child => this.visit(child))
    })
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(stmt => this.visit(stmt))
    })
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    const baseLevel = this.indentLevel
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    this.push(indent + open + content + close)

    node.conditions.forEach(condition => this.visit(condition))
    if (node.else_clause) this.visit(node.else_clause)

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.statements.forEach(statement => this.visit(statement))
    })

    if (node.rescue_clause) this.visit(node.rescue_clause)
    if (node.else_clause) this.visit(node.else_clause)
    if (node.ensure_clause) this.visit(node.ensure_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.visitERBGeneric(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.visitERBGeneric(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.visitERBGeneric(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.visitERBGeneric(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.visitERBGeneric(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.visitERBGeneric(node)
  }

  // TODO: don't use any
  private visitERBGeneric(node: any): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      const statements: any[] = node.statements ?? node.body ?? node.children ?? []

      statements.forEach(statement => this.visit(statement))
    })

    if (node.end_node) this.visit(node.end_node)
  }

  // --- Utility methods ---

  private isNonWhitespaceNode(node: Node): boolean {
    if (node instanceof HTMLTextNode || (node as any).type === 'AST_HTML_TEXT_NODE') {
      return (node as HTMLTextNode).content.trim() !== ""
    }

    if (node instanceof WhitespaceNode || (node as any).type === 'AST_WHITESPACE_NODE') {
      return false
    }

    return true
  }

  private renderInlineOpen(name: string, attributes: HTMLAttributeNode[], selfClose: boolean, inlineNodes: Node[] = [], allChildren: Node[] = []): string {
    const parts = attributes.map(attribute => this.renderAttribute(attribute))

    if (inlineNodes.length > 0) {
      let result = `<${name}`

      if (allChildren.length > 0) {
        const currentIndentLevel = this.indentLevel
        this.indentLevel = 0
        const tempLines = this.lines
        this.lines = []

        allChildren.forEach(child => {
          if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
            this.lines.push(" " + this.renderAttribute(child as HTMLAttributeNode))
          } else if (!(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')) {
            const wasInlineMode = this.inlineMode
            this.inlineMode = true

            this.lines.push(" ")

            this.visit(child)
            this.inlineMode = wasInlineMode
          }
        })

        const inlineContent = this.lines.join("")
        this.lines = tempLines
        this.indentLevel = currentIndentLevel

        result += inlineContent
      } else {
        if (parts.length > 0) {
          result += ` ${parts.join(" ")}`
        }

        const currentIndentLevel = this.indentLevel
        this.indentLevel = 0
        const tempLines = this.lines
        this.lines = []

        inlineNodes.forEach(node => {
          const wasInlineMode = this.inlineMode
          this.inlineMode = true
          this.visit(node)
          this.inlineMode = wasInlineMode
        })

        const inlineContent = this.lines.join("")
        this.lines = tempLines
        this.indentLevel = currentIndentLevel

        result += inlineContent
      }

      result += selfClose ? " />" : ">"

      return result
    }

    return `<${name}${parts.length ? " " + parts.join(" ") : ""}${selfClose ? " /" : ""}>`
  }

  renderAttribute(attribute: HTMLAttributeNode): string {
    const name = (attribute.name as HTMLAttributeNameNode)!.name!.value ?? ""
    const equals = attribute.equals?.value ?? ""

    let value = ""

    if (attribute.value && (attribute.value instanceof HTMLAttributeValueNode || (attribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE')) {
      const attrValue = attribute.value as HTMLAttributeValueNode
      const open_quote = (attrValue.open_quote?.value ?? "")
      const close_quote = (attrValue.close_quote?.value ?? "")
      const attribute_value = attrValue.children.map((attr: any) => {
        if (attr instanceof HTMLTextNode || (attr as any).type === 'AST_HTML_TEXT_NODE' || attr instanceof LiteralNode || (attr as any).type === 'AST_LITERAL_NODE') {

          return (attr as HTMLTextNode | LiteralNode).content
        } else if (attr instanceof ERBContentNode || (attr as any).type === 'AST_ERB_CONTENT_NODE') {
          const erbAttr = attr as ERBContentNode

          return (erbAttr.tag_opening!.value + erbAttr.content!.value + erbAttr.tag_closing!.value)
        }

        return ""
      }).join("")

      value = open_quote + attribute_value + close_quote
    }

    return name + equals + value
  }

  /**
   * Try to render children inline if they are simple enough.
   * Returns the inline string if possible, null otherwise.
   */
  private tryRenderInline(children: Node[], tagName: string, depth: number = 0): string | null {
    if (children.length > 10) {
      return null
    }

    const maxNestingDepth = this.getMaxNestingDepth(children, 0)

    if (maxNestingDepth > 1) {
      this.isInComplexNesting = true
      return null
    }

    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textContent = (child as HTMLTextNode).content

        if (textContent.includes('\n')) {
          return null
        }
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode

        const attributes = openTag.children.filter((child): child is HTMLAttributeNode =>
          child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
        )

        if (attributes.length > 0) {
          return null
        }

      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        // ERB content nodes are allowed in inline rendering
      } else {
        return null
      }
    }

    const oldLines = this.lines
    const oldInlineMode = this.inlineMode

    try {
      this.lines = []
      this.inlineMode = true

      let content = ''

      for (const child of children) {
        if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
          content += (child as HTMLTextNode).content
        } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
          const element = child as HTMLElementNode
          const openTag = element.open_tag as HTMLOpenTagNode
          const childTagName = openTag?.tag_name?.value || ''

          const attributes = openTag.children.filter((child): child is HTMLAttributeNode =>
            child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
          )

          const attributesString = attributes.length > 0
            ? ' ' + attributes.map(attr => this.renderAttribute(attr)).join(' ')
            : ''

          const elementContent = this.renderElementInline(element)

          content += `<${childTagName}${attributesString}>${elementContent}</${childTagName}>`
        } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
          const erbNode = child as ERBContentNode
          const open = erbNode.tag_opening?.value ?? ""
          const erbContent = erbNode.content?.value ?? ""
          const close = erbNode.tag_closing?.value ?? ""

          content += `${open}${this.formatERBContent(erbContent)}${close}`
        }
      }

      content = content.replace(/\s+/g, ' ').trim()

      return `<${tagName}>${content}</${tagName}>`

    } finally {
      this.lines = oldLines
      this.inlineMode = oldInlineMode
    }
  }

  /**
   * Calculate the maximum nesting depth in a subtree of nodes.
   */
  private getMaxNestingDepth(children: Node[], currentDepth: number): number {
    let maxDepth = currentDepth

    for (const child of children) {
      if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const elementChildren = element.body.filter(
          child =>
            !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
            !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
        )

        const childDepth = this.getMaxNestingDepth(elementChildren, currentDepth + 1)
        maxDepth = Math.max(maxDepth, childDepth)
      }
    }

    return maxDepth
  }

  /**
   * Render an HTML element's content inline (without the wrapping tags).
   */
  private renderElementInline(element: HTMLElementNode): string {
    const children = element.body.filter(
      child =>
        !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
        !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
    )

    let content = ''
    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        content += (child as HTMLTextNode).content
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const childElement = child as HTMLElementNode
        const openTag = childElement.open_tag as HTMLOpenTagNode
        const childTagName = openTag?.tag_name?.value || ''

        const attributes = openTag.children.filter((child): child is HTMLAttributeNode =>
          child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
        )

        const attributesString = attributes.length > 0
          ? ' ' + attributes.map(attr => this.renderAttribute(attr)).join(' ')
          : ''

        const childContent = this.renderElementInline(childElement)
        content += `<${childTagName}${attributesString}>${childContent}</${childTagName}>`
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        const erbNode = child as ERBContentNode
        const open = erbNode.tag_opening?.value ?? ""
        const erbContent = erbNode.content?.value ?? ""
        const close = erbNode.tag_closing?.value ?? ""

        content += `${open}${this.formatERBContent(erbContent)}${close}`
      }
    }

    return content.replace(/\s+/g, ' ').trim()
  }
}
