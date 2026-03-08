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

interface LineSegment {
  text: string
  isERB: boolean
  node?: ERBContentNode
}

class LineContextCollector extends Visitor {
  public lineMap: Map<number, LineInfo> = new Map()
  public erbNodesPerLine: Map<number, ERBContentNode[]> = new Map()
  public htmlCommentNodesPerLine: Map<number, HTMLCommentNode> = new Map()

  visitERBNode(node: ERBNode): void {
    if (!node.tag_opening || !node.tag_closing) return

    const startLine = lspLine(node.tag_opening.location.start)

    const nodes = this.erbNodesPerLine.get(startLine) || []
    nodes.push(node as ERBContentNode)
    this.erbNodesPerLine.set(startLine, nodes)

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
      this.htmlCommentNodesPerLine.set(line, node)
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

      const htmlCommentNode = collector.htmlCommentNodesPerLine.get(line)
      const info = collector.lineMap.get(line)

      if (htmlCommentNode && this.htmlCommentSpansLine(htmlCommentNode, lineText)) {
        lineInfos.push({ line, context: "html-comment", node: htmlCommentNode })
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
        const erbNodes = collector.erbNodesPerLine.get(info.line) || []
        const edit = this.uncommentLine(info, lineText, erbNodes)

        if (edit) edits.push(edit)
      }
    } else {
      for (const info of lineInfos) {
        if (info.context === "erb-comment" || info.context === "html-comment") continue

        const lineText = document.getText(Range.create(info.line, 0, info.line + 1, 0)).replace(/\n$/, "")
        const erbNodes = collector.erbNodesPerLine.get(info.line) || []
        const edit = this.commentLine(info, lineText, erbNodes)

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

  private commentLine(info: LineInfo, lineText: string, erbNodes: ERBContentNode[]): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)

    if (info.context === "erb-tag") {
      if (erbNodes.length === 1) {
        const node = erbNodes[0]
        if (!node.tag_opening || !node.tag_closing) return null

        if (lspLine(node.tag_opening.location.start) !== info.line) return null

        const nodeStart = node.tag_opening.location.start.column
        const nodeEnd = node.tag_closing.location.end.column
        const isSoleContent = lineText.substring(0, nodeStart).trim() === "" && lineText.substring(nodeEnd).trim() === ""

        if (isSoleContent) {
          const insertColumn = nodeStart + 2

          return TextEdit.insert(Position.create(info.line, insertColumn), "#")
        }

        const segments = this.getLineSegments(lineText, erbNodes)

        return TextEdit.replace(lineRange, this.commentWholeLine(segments, lineText))
      }

      const segments = this.getLineSegments(lineText, erbNodes)
      const hasHTML = segments.some(s => !s.isERB && s.text.trim() !== "")

      if (!hasHTML) {
        return TextEdit.replace(lineRange, this.commentERBSegments(segments, lineText))
      }

      const allControlTags = erbNodes.every(n => n.tag_opening?.value === "<%")

      if (allControlTags) {
        return TextEdit.replace(lineRange, this.commentPerSegment(segments, lineText))
      }

      return TextEdit.replace(lineRange, this.commentWholeLine(segments, lineText))
    }

    if (info.context === "html-content") {
      if (erbNodes.length > 0) {
        const segments = this.getLineSegments(lineText, erbNodes)

        return TextEdit.replace(lineRange, this.commentWholeLine(segments, lineText))
      }

      const indent = this.getIndentation(lineText)
      const content = lineText.trimStart()

      return TextEdit.replace(lineRange, `${indent}<!-- ${content} -->`)
    }

    return null
  }

  private uncommentLine(info: LineInfo, lineText: string, erbNodes: ERBContentNode[]): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)

    if (info.context === "erb-comment") {
      if (erbNodes.length > 1) {
        const segments = this.getLineSegments(lineText, erbNodes)
        const hasHTMLComments = segments.some(s => !s.isERB && s.text.trim().startsWith("<!--"))

        if (hasHTMLComments) {
          return TextEdit.replace(lineRange, this.uncommentPerSegment(segments, lineText))
        }

        return TextEdit.replace(lineRange, this.uncommentERBSegments(segments, lineText))
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
      const commentNode = info.node as HTMLCommentNode | null

      if (commentNode?.comment_start && commentNode?.comment_end) {
        const indent = this.getIndentation(lineText)
        const contentStart = commentNode.comment_start.location.end.column
        const contentEnd = commentNode.comment_end.location.start.column
        const innerContent = lineText.substring(contentStart, contentEnd).trim()
        const innerERBNodes = this.parseERBNodes(innerContent)

        if (innerERBNodes.length > 0) {
          const segments = this.getLineSegments(innerContent, innerERBNodes)

          return TextEdit.replace(lineRange, `${indent}${this.uncommentERBSegments(segments, innerContent)}`)
        }

        return TextEdit.replace(lineRange, `${indent}${innerContent}`)
      }
    }

    return null
  }

  private getLineSegments(lineText: string, erbNodes: ERBContentNode[]): LineSegment[] {
    const segments: LineSegment[] = []
    let pos = 0

    const sorted = [...erbNodes].sort(
      (a, b) => a.tag_opening!.location.start.column - b.tag_opening!.location.start.column
    )

    for (const node of sorted) {
      const nodeStart = node.tag_opening!.location.start.column
      const nodeEnd = node.tag_closing!.location.end.column

      if (nodeStart > pos) {
        segments.push({ text: lineText.substring(pos, nodeStart), isERB: false })
      }

      segments.push({ text: lineText.substring(nodeStart, nodeEnd), isERB: true, node })
      pos = nodeEnd
    }

    if (pos < lineText.length) {
      segments.push({ text: lineText.substring(pos), isERB: false })
    }

    return segments
  }

  private commentERBSegments(segments: LineSegment[], lineText: string): string {
    const indent = this.getIndentation(lineText)

    const result = segments.map(segment => {
      if (segment.isERB) {
        return segment.text.substring(0, 2) + "#" + segment.text.substring(2)
      }

      return segment.text
    }).join("")

    return indent + result.trimStart()
  }

  private uncommentERBSegments(segments: LineSegment[], lineText: string): string {
    const indent = this.getIndentation(lineText)

    const result = segments.map(segment => {
      if (segment.isERB && segment.node?.tag_opening?.value === "<%#") {
        return segment.text.substring(0, 2) + segment.text.substring(3)
      }

      return segment.text
    }).join("")

    return indent + result.trimStart()
  }

  private commentPerSegment(segments: LineSegment[], lineText: string): string {
    const indent = this.getIndentation(lineText)

    const result = segments.map(segment => {
      if (segment.isERB) {
        return segment.text.substring(0, 2) + "#" + segment.text.substring(2)
      } else if (segment.text.trim() !== "") {
        return `<!-- ${segment.text} -->`
      }

      return segment.text
    }).join("")

    return indent + result.trimStart()
  }

  private uncommentPerSegment(segments: LineSegment[], lineText: string): string {
    const indent = this.getIndentation(lineText)

    const result = segments.map(segment => {
      if (segment.isERB && segment.node?.tag_opening?.value === "<%#") {
        return segment.text.substring(0, 2) + segment.text.substring(3)
      } else if (!segment.isERB) {
        const match = segment.text.match(/^<!-- (.*?) -->$/)

        if (match) return match[1]
      }

      return segment.text
    }).join("")

    return indent + result.trimStart()
  }

  private commentWholeLine(segments: LineSegment[], lineText: string): string {
    const indent = this.getIndentation(lineText)

    const content = segments.map(segment => {
      if (segment.isERB) {
        return segment.text.substring(0, 2) + "#" + segment.text.substring(2)
      }

      return segment.text
    }).join("").trimStart()

    return `${indent}<!-- ${content} -->`
  }

  private htmlCommentSpansLine(node: HTMLCommentNode, lineText: string): boolean {
    if (!node.comment_start || !node.comment_end) return false

    const commentStart = node.comment_start.location.start.column
    const commentEnd = node.comment_end.location.end.column
    const contentBefore = lineText.substring(0, commentStart).trim()
    const contentAfter = lineText.substring(commentEnd).trim()

    return contentBefore === "" && contentAfter === ""
  }

  private parseERBNodes(content: string): ERBContentNode[] {
    const document = this.parserService.parseContent(content)
    const collector = new LineContextCollector()

    collector.visit(document)

    return collector.erbNodesPerLine.get(0) || []
  }

  private getIndentation(lineText: string): string {
    const match = lineText.match(/^(\s*)/)

    return match ? match[1] : ""
  }
}
