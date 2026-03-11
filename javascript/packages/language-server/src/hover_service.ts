import { Hover, MarkupKind, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter } from "@herb-tools/rewriter"
import { isERBOpenTagNode } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { nodeToRange, isPositionInRange, rangeSize } from "./range_utils"
import { ACTION_VIEW_HELPERS } from "./action_view_helpers"

import type { Node, HTMLElementNode } from "@herb-tools/core"
import type { Range } from "vscode-languageserver/node"

class ActionViewElementCollector extends Visitor {
  public elements: { node: HTMLElementNode; range: Range }[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && node.element_source !== "HTML" && isERBOpenTagNode(node.open_tag)) {
      this.elements.push({
        node,
        range: nodeToRange(node),
      })
    }

    this.visitChildNodes(node)
  }
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

    let bestElement: { node: HTMLElementNode; range: Range } | null = null
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
    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    const rewrittenNode = rewriter.rewrite(bestElement.node as Node, { baseDir: process.cwd() })
    const htmlOutput = IdentityPrinter.print(rewrittenNode)
    const helper = ACTION_VIEW_HELPERS[elementSource]
    const parts: string[] = []

    if (helper) {
      parts.push(`\`\`\`ruby\n${helper.signature}\n\`\`\``)
    }

    parts.push(`**HTML equivalent**\n\`\`\`erb\n${htmlOutput.trim()}\n\`\`\``)

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

}
