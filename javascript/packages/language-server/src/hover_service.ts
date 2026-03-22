import { Hover, MarkupKind, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter } from "@herb-tools/rewriter"
import { isERBOpenTagNode, isHTMLElementNode } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { lspPosition, isPositionInRange, rangeSize } from "./range_utils"
import { ACTION_VIEW_HELPERS } from "./action_view_helpers"

import type { HTMLElementNode, ERBOpenTagNode } from "@herb-tools/core"

class ActionViewElementCollector extends Visitor {
  public elements: { node: HTMLElementNode; openTag: ERBOpenTagNode; range: Range }[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && node.element_source !== "HTML" && isERBOpenTagNode(node.open_tag)) {
      const content = node.open_tag.content
      const tagName = node.open_tag.tag_name

      if (content && tagName) {
        const isTagHelper = node.element_source === "ActionView::Helpers::TagHelper#tag"
        const methodName = isTagHelper ? `tag.${tagName.value}` : node.element_source.split("#").pop()!

        const offset = content.value.indexOf(methodName)

        if (offset !== -1) {
          const contentStart = lspPosition(content.location.start)
          const start = Position.create(contentStart.line, contentStart.character + offset)
          const end = Position.create(start.line, start.character + methodName.length)

          this.elements.push({
            node,
            openTag: node.open_tag,
            range: Range.create(start, end),
          })
        }
      }
    }

    this.visitChildNodes(node)
  }
}

function dedent(text: string): string {
  const lines = text.split("\n")
  const indents = lines.filter(line => line.trim().length > 0).map(line => line.match(/^(\s*)/)?.[1].length ?? 0)
  const minIndent = Math.min(...indents)

  if (minIndent === 0) return text

  return lines.map(line => line.slice(minIndent)).join("\n")
}

export class HoverService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getHover(textDocument: TextDocument, position: Position): Hover | null {
    const parseResult = this.parserService.parseContent(textDocument.getText(), {
      action_view_helpers: true,
      track_whitespace: true,
    })

    const collector = new ActionViewElementCollector()
    collector.visit(parseResult.value)

    let bestElement: { node: HTMLElementNode; openTag: ERBOpenTagNode; range: Range } | null = null
    let bestSize = Infinity

    for (const element of collector.elements) {
      if (isPositionInRange(position, element.range)) {
        const size = rangeSize(element.range)

        if (size < bestSize) {
          bestSize = size
          bestElement = element
        }
      }
    }

    if (!bestElement) {
      return null
    }

    const elementSource = bestElement.node.element_source
    const isLeaf = !bestElement.node.body.some(child => isHTMLElementNode(child))
    const helper = ACTION_VIEW_HELPERS[elementSource]
    const parts: string[] = []

    if (helper) {
      parts.push(`\`\`\`ruby\n${helper.signature}\n\`\`\``)
    }

    if (isLeaf) {
      const rewriter = new ActionViewTagHelperToHTMLRewriter()
      const rewrittenNode = rewriter.rewrite(bestElement.node, { baseDir: process.cwd(), shallow: true })
      const htmlOutput = IdentityPrinter.print(rewrittenNode)

      parts.push(`**HTML equivalent**\n\`\`\`erb\n${dedent(htmlOutput.trim())}\n\`\`\``)
    } else {
      const shallowResult = this.rewriteElement(textDocument, bestElement.node, { includeBody: false })

      parts.push(`**HTML equivalent**\n\`\`\`erb\n${dedent(shallowResult.trim())}\n\`\`\``)
    }

    if (helper) {
      parts.push(`[${elementSource}](${helper.documentationURL})`)
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: parts.join("\n\n"),
      },
      range: bestElement.range,
    }
  }

  private rewriteElement(textDocument: TextDocument, node: HTMLElementNode, options: { includeBody: boolean }): string {
    const parseResult = this.parserService.parseContent(textDocument.getText(), {
      action_view_helpers: true,
      track_whitespace: true,
    })

    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    const collector = new ActionViewElementCollector()

    collector.visit(parseResult.value)

    const match = collector.elements.find(element =>
      element.node.location.start.line === node.location.start.line &&
      element.node.location.start.column === node.location.start.column
    )

    if (!match) return ""

    const rewrittenNode = rewriter.rewrite(match.node, {
      baseDir: process.cwd(),
      shallow: true,
      includeBody: options.includeBody,
    })

    if (!options.includeBody) {
      const openTag = match.node.open_tag ? IdentityPrinter.print(match.node.open_tag) : ""
      const closeTag = match.node.close_tag ? IdentityPrinter.print(match.node.close_tag) : ""
      return `${openTag}\n  ...\n${closeTag}`
    }

    return IdentityPrinter.print(rewrittenNode)
  }
}
