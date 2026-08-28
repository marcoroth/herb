import { CodeAction, CodeActionKind, TextEdit, WorkspaceEdit, Range, Position } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter, HTMLToActionViewTagHelperRewriter, cloneNode } from "@herb-tools/rewriter"
import { isERBOpenTagNode, isHTMLOpenTagNode, HELPER_BY_SOURCE, findPreferredHelperForTag } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { nodeToRange } from "./range_utils"

import type { Node, HTMLElementNode } from "@herb-tools/core"
import type { FrameworkOptions } from "./types.js"

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

export class RewriteCodeActionProvider {
  private parserService: ParserService

  private readonly baseDir: string

  constructor(parserService: ParserService, baseDir: string = ".") {
    this.parserService = parserService
    this.baseDir = baseDir
  }

  getCodeActions(document: TextDocument, requestedRange: Range, options?: FrameworkOptions): CodeAction[] {
    if (options?.framework !== "actionview") return []

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
    const rewrittenNode = rewriter.rewrite(cloneNode(parseResult.value as Node), { baseDir: this.baseDir, shallow: true })

    const rewrittenText = IdentityPrinter.print(rewrittenNode)

    if (rewrittenText === originalText) return null

    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: [TextEdit.replace(element.elementRange, rewrittenText)]
      }
    }

    const elementSource = element.node.element_source
    const helper = elementSource ? HELPER_BY_SOURCE[elementSource] : undefined
    const tagName = helper?.tagName ?? element.node.tag_name?.value
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
    const rewrittenNode = rewriter.rewrite(cloneNode(parseResult.value as Node), { baseDir: this.baseDir, shallow: true })

    const rewrittenText = IdentityPrinter.print(rewrittenNode)

    if (rewrittenText === originalText) return null

    const edit: WorkspaceEdit = {
      changes: {
        [document.uri]: [TextEdit.replace(element.elementRange, rewrittenText)]
      }
    }

    const tagName = element.node.tag_name?.value
    const helper = tagName ? findPreferredHelperForTag(tagName) : undefined
    const methodName = tagName?.replace(/-/g, "_")
    const title = helper
      ? `Herb: Convert to \`${helper.name}\``
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
    if (this.comparePositions(r1.end, r2.start) < 0) return false
    if (this.comparePositions(r2.end, r1.start) < 0) return false

    return true
  }

  private comparePositions(a: Position, b: Position): number {
    if (a.line !== b.line) return a.line - b.line

    return a.character - b.character
  }
}
