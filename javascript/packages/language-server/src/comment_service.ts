import { TextEdit, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { ParserService } from "./parser_service"

import { lspLine } from "./range_utils"
import { isERBCommentNode } from "@herb-tools/core"

import type {
  Node,
  ERBNode,
  ERBContentNode,
  HTMLCommentNode,
  HTMLTextNode,
  HTMLElementNode,
} from "@herb-tools/core"

type LineContext = "erb-comment" | "html-comment" | "erb-tag" | "html-content" | "empty"

interface LineInfo {
  line: number
  context: LineContext
  node: Node | null
}

class LineContextCollector extends Visitor {
  public lineMap: Map<number, LineInfo> = new Map()

  visitERBNode(node: ERBNode): void {
    if (!node.tag_opening || !node.tag_closing) return

    const startLine = lspLine(node.tag_opening.location.start)

    if (isERBCommentNode(node)) {
      this.setLine(startLine, "erb-comment", node)
    } else {
      this.setLine(startLine, "erb-tag", node)
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.visitERBNode(node)
    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      this.setLine(line, "html-comment", node)
    }

    this.visitChildNodes(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      if (!this.lineMap.has(line)) {
        this.setLine(line, "html-content", node)
      }
    }

    this.visitChildNodes(node)
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      if (!this.lineMap.has(line)) {
        this.setLine(line, "html-content", node)
      }
    }

    this.visitChildNodes(node)
  }

  private setLine(line: number, context: LineContext, node: Node): void {
    const existing = this.lineMap.get(line)

    if (existing) {
      if (existing.context === "erb-comment" || existing.context === "erb-tag") return

      if (context === "erb-comment" || context === "erb-tag") {
        this.lineMap.set(line, { line, context, node })

        return
      }

      if (existing.context === "html-comment") return
    }

    this.lineMap.set(line, { line, context, node })
  }
}

export class CommentService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  toggleLineComment(document: TextDocument, range: Range): TextEdit[] {
    const parseResult = this.parserService.parseDocument(document)
    const collector = new LineContextCollector()

    collector.visit(parseResult.document)

    const startLine = range.start.line
    const endLine = range.end.line
    const lineInfos: LineInfo[] = []

    for (let line = startLine; line <= endLine; line++) {
      const lineText = document.getText(Range.create(line, 0, line + 1, 0)).replace(/\n$/, "")

      if (lineText.trim() === "") {
        continue
      }

      const info = collector.lineMap.get(line)
      const trimmed = lineText.trim()

      if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
        lineInfos.push({ line, context: "html-comment", node: null })
      } else if (info) {
        lineInfos.push(info)
      } else {
        lineInfos.push({ line, context: "html-content", node: null })
      }
    }

    if (lineInfos.length === 0) return []

    const allCommented = lineInfos.every(
      info => info.context === "erb-comment" || info.context === "html-comment"
    )

    const edits: TextEdit[] = []

    if (allCommented) {
      for (const info of lineInfos) {
        const lineText = document.getText(Range.create(info.line, 0, info.line + 1, 0)).replace(/\n$/, "")
        const edit = this.uncommentLine(info, lineText)

        if (edit) edits.push(edit)
      }
    } else {
      for (const info of lineInfos) {
        if (info.context === "erb-comment" || info.context === "html-comment") continue

        const lineText = document.getText(Range.create(info.line, 0, info.line + 1, 0)).replace(/\n$/, "")
        const edit = this.commentLine(info, lineText)

        if (edit) edits.push(edit)
      }
    }

    return edits
  }

  toggleBlockComment(document: TextDocument, range: Range): TextEdit[] {
    const startLine = range.start.line
    const endLine = range.end.line

    const firstLineText = document.getText(Range.create(startLine, 0, startLine + 1, 0)).replace(/\n$/, "")
    const lastLineText = document.getText(Range.create(endLine, 0, endLine + 1, 0)).replace(/\n$/, "")
    const isWrapped = firstLineText.trim() === "<% if false %>" && lastLineText.trim() === "<% end %>"

    if (isWrapped) {
      return [
        TextEdit.del(Range.create(endLine, 0, endLine + 1, 0)),
        TextEdit.del(Range.create(startLine, 0, startLine + 1, 0)),
      ]
    } else {
      const firstLineIndent = this.getIndentation(firstLineText)

      return [
        TextEdit.insert(Position.create(endLine + 1, 0), `${firstLineIndent}<% end %>\n`),
        TextEdit.insert(Position.create(startLine, 0), `${firstLineIndent}<% if false %>\n`),
      ]
    }
  }

  private commentLine(info: LineInfo, lineText: string): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)

    if (info.context === "erb-tag") {
      const isSingleERBTag = /^\s*<%(?:(?!%>).)*%>\s*$/.test(lineText)

      if (!isSingleERBTag) {
        const isAllERB = lineText.replace(/<%(?:(?!%>).)*%>/g, "").trim() === ""

        if (isAllERB) {
          return TextEdit.replace(lineRange, this.commentERBTags(lineText))
        }

        const allControlTags = Array.from(lineText.matchAll(/<%(\S?)/g)).every(m => m[1] === "" || m[1] === " ")

        if (allControlTags) {
          return TextEdit.replace(lineRange, this.commentMixedSegments(lineText))
        }

        const indent = this.getIndentation(lineText)
        const content = this.commentERBTags(lineText.trimStart())

        return TextEdit.replace(lineRange, `${indent}<!-- ${content} -->`)
      }

      const node = info.node as ERBContentNode
      if (!node?.tag_opening) return null

      if (lspLine(node.tag_opening.location.start) !== info.line) {
        return null
      }

      const insertColumn = node.tag_opening.location.start.column + 2

      return TextEdit.insert(Position.create(info.line, insertColumn), "#")
    }

    if (info.context === "html-content") {
      const indent = this.getIndentation(lineText)
      const content = this.commentERBTags(lineText.trimStart())

      return TextEdit.replace(lineRange, `${indent}<!-- ${content} -->`)
    }

    return null
  }

  private uncommentLine(info: LineInfo, lineText: string): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)

    if (info.context === "erb-comment") {
      const isSingleERBTag = /^\s*<%(?:(?!%>).)*%>\s*$/.test(lineText)

      if (!isSingleERBTag) {
        const isAllERBComments = lineText.replace(/<%#(?:(?!%>).)*%>/g, "").trim() === ""

        if (isAllERBComments) {
          return TextEdit.replace(lineRange, this.uncommentERBTags(lineText))
        }

        return TextEdit.replace(lineRange, this.uncommentMixedSegments(lineText))
      }

      const node = info.node as ERBContentNode
      if (!node?.tag_opening || !node?.tag_closing) return null

      const contentValue = (node as any).content?.value as string | null
      const trimmedContent = contentValue?.trim() || ""

      if (trimmedContent.startsWith("<") && !trimmedContent.startsWith("<%")) {
        const indent = this.getIndentation(lineText)

        return TextEdit.replace(lineRange, `${indent}${trimmedContent}`)
      }

      if (lspLine(node.tag_opening.location.start) !== info.line) return null

      const hashColumn = node.tag_opening.location.start.column + 2

      if (
        contentValue?.startsWith(" graphql ") ||
        contentValue?.startsWith(" %= ") ||
        contentValue?.startsWith(" == ") ||
        contentValue?.startsWith(" % ") ||
        contentValue?.startsWith(" = ") ||
        contentValue?.startsWith(" - ")
      ) {
        return TextEdit.del(Range.create(info.line, hashColumn, info.line, hashColumn + 2))
      }

      return TextEdit.del(Range.create(info.line, hashColumn, info.line, hashColumn + 1))
    }

    if (info.context === "html-comment") {
      const indent = this.getIndentation(lineText)
      const match = lineText.match(/<!--\s*(.*?)\s*-->/)

      if (match) {
        const content = this.uncommentERBTags(match[1])

        return TextEdit.replace(lineRange, `${indent}${content}`)
      }
    }

    return null
  }

  private commentMixedSegments(lineText: string): string {
    const indent = this.getIndentation(lineText)
    const content = lineText.trimStart()
    const segments = content.split(/(<%(?:(?!%>).)*%>)/)

    const commented = segments.map(segment => {
      if (/^<%/.test(segment)) {
        return segment.replace("<%", "<%#")
      } else if (segment.trim() !== "") {
        return `<!-- ${segment} -->`
      } else {
        return segment
      }
    }).join("")

    return `${indent}${commented}`
  }

  private uncommentMixedSegments(lineText: string): string {
    const indent = this.getIndentation(lineText)
    let content = lineText.trimStart()

    content = content.replace(/<%#/g, "<%")
    content = content.replace(/<!-- (.*?) -->/g, "$1")

    return `${indent}${content}`
  }

  private commentERBTags(content: string): string {
    return content.replace(/<%(?!#)/g, "<%#")
  }

  private uncommentERBTags(content: string): string {
    return content.replace(/<%#/g, "<%")
  }

  private getIndentation(lineText: string): string {
    const match = lineText.match(/^(\s*)/)

    return match ? match[1] : ""
  }
}
