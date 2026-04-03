import { CodeAction, CodeActionKind, TextEdit, WorkspaceEdit, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor, Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter, HTMLToActionViewTagHelperRewriter } from "@herb-tools/rewriter"
import { isERBOpenTagNode, isHTMLOpenTagNode } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { nodeToRange } from "./range_utils"

import type { Node, HTMLElementNode } from "@herb-tools/core"

interface CollectedElement {
  node: HTMLElementNode
  elementRange: Range
  openTagRange: Range
}

class ElementCollector extends Visitor {
  public actionViewElements: CollectedElement[] = []
  public htmlElements: CollectedElement[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && node.element_source !== "HTML" && isERBOpenTagNode(node.open_tag)) {
      this.actionViewElements.push({
        node,
        elementRange: nodeToRange(node),
        openTagRange: nodeToRange(node.open_tag),
      })
    } else if (isHTMLOpenTagNode(node.open_tag) && node.open_tag.tag_name) {
      this.htmlElements.push({
        node,
        elementRange: nodeToRange(node),
        openTagRange: nodeToRange(node.open_tag),
      })
    }

    this.visitChildNodes(node)
  }
}

export class RewriteCodeActionService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getCodeActions(document: TextDocument, requestedRange: Range): CodeAction[] {
    const parseResult = this.parserService.parseContent(document.getText(), {
      action_view_helpers: true,
      track_whitespace: true,
    })

    const collector = new ElementCollector()
    collector.visit(parseResult.value)

    const actions: CodeAction[] = []

    for (const element of collector.actionViewElements) {
      if (!this.rangesOverlap(element.openTagRange, requestedRange)) continue

      const action = this.createActionViewToHTMLAction(document, element)

      if (action) {
        actions.push(action)
      }
    }

    for (const element of collector.htmlElements) {
      if (!this.rangesOverlap(element.openTagRange, requestedRange)) continue

      const action = this.createHTMLToActionViewAction(document, element)

      if (action) {
        actions.push(action)
      }
    }

    return actions
  }

  private createActionViewToHTMLAction(document: TextDocument, element: CollectedElement): CodeAction | null {
    const originalText = document.getText(element.elementRange)

    const parseResult = this.parserService.parseContent(originalText, {
      action_view_helpers: true,
      track_whitespace: true,
    })

    if (parseResult.failed) return null

    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    rewriter.rewrite(parseResult.value as Node, { baseDir: process.cwd() })

    const rewrittenText = IdentityPrinter.print(parseResult.value)

    if (rewrittenText === originalText) return null

    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: [TextEdit.replace(element.elementRange, rewrittenText)]
      }
    }

    const tagName = element.node.tag_name?.value
    const title = tagName
      ? `Herb: Convert to \`<${tagName}>\``
      : "Herb: Convert to HTML"

    return {
      title,
      kind: CodeActionKind.RefactorRewrite,
      edit,
    }
  }

  private createHTMLToActionViewAction(document: TextDocument, element: CollectedElement): CodeAction | null {
    const originalText = document.getText(element.elementRange)

    const parseResult = this.parserService.parseContent(originalText, {
      track_whitespace: true,
    })

    if (parseResult.failed) return null

    const rewriter = new HTMLToActionViewTagHelperRewriter()
    rewriter.rewrite(parseResult.value as Node, { baseDir: process.cwd() })

    const rewrittenText = IdentityPrinter.print(parseResult.value)

    if (rewrittenText === originalText) return null

    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: [TextEdit.replace(element.elementRange, rewrittenText)]
      }
    }

    const tagName = element.node.tag_name?.value
    const isAnchor = tagName === "a"
    const isTurboFrame = tagName === "turbo-frame"
    const isImg = tagName === "img"
    const methodName = tagName?.replace(/-/g, "_")
    const title = isAnchor
      ? "Herb: Convert to `link_to`"
      : isTurboFrame
        ? "Herb: Convert to `turbo_frame_tag`"
        : isImg
          ? "Herb: Convert to `image_tag`"
          : methodName
            ? `Herb: Convert to \`tag.${methodName}\``
            : "Herb: Convert to tag helper"

    return {
      title,
      kind: CodeActionKind.RefactorRewrite,
      edit,
    }
  }

  private rangesOverlap(r1: Range, r2: Range): boolean {
    if (r1.end.line < r2.start.line) return false
    if (r1.start.line > r2.end.line) return false

    if (r1.end.line === r2.start.line && r1.end.character < r2.start.character) return false
    if (r1.start.line === r2.end.line && r1.start.character > r2.end.character) return false

    return true
  }
}
