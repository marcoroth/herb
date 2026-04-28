import { TextEdit, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { ParserService } from "./parser_service"
import { LineContextCollector } from "./line_context_collector"

import { lspLine } from "./range_utils"
import { determineStrategy, commentLineContent, uncommentLineContent } from "./comment_ast_utils"

import type { LineInfo } from "./line_context_collector"
import type { ERBContentNode, HTMLCommentNode } from "@herb-tools/core"

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

      if (this.lineIsIfFalseWrapped(lineText) !== null) {
        lineInfos.push({ line, context: "erb-comment", node: null })
        continue
      }

      const htmlCommentNode = collector.htmlCommentNodesPerLine.get(line)
      const info = collector.lineMap.get(line)

      if (htmlCommentNode && this.htmlCommentSpansLine(htmlCommentNode, lineText)) {
        lineInfos.push({ line, context: "html-comment", node: htmlCommentNode })
      } else if (info) {
        if (info.context === "html-comment") {
          lineInfos.push({ line, context: "html-content", node: null })
        } else {
          lineInfos.push(info)
        }
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
        const edit = this.uncommentLine(info, lineText, collector)

        if (edit) edits.push(edit)
      }
    } else {
      for (const info of lineInfos) {
        if (info.context === "erb-comment" || info.context === "html-comment") continue

        const lineText = document.getText(Range.create(info.line, 0, info.line + 1, 0)).replace(/\n$/, "")
        const erbNodes = collector.erbNodesPerLine.get(info.line) || []
        const edit = this.commentLine(info, lineText, erbNodes, collector)

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

  private commentLine(info: LineInfo, lineText: string, erbNodes: ERBContentNode[], collector: LineContextCollector): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)
    const indent = this.getIndentation(lineText)
    const content = lineText.trimStart()
    const htmlCommentNode = collector.htmlCommentNodesPerLine.get(info.line)

    if (htmlCommentNode) {
      return TextEdit.replace(lineRange, `${indent}<% if false %>${content}<% end %>`)
    }

    const strategy = determineStrategy(erbNodes, lineText)

    if (strategy === "single-erb") {
      const node = erbNodes[0]
      const insertColumn = node.tag_opening!.location.start.column + 2

      return TextEdit.insert(Position.create(info.line, insertColumn), "#")
    }

    const result = commentLineContent(content, erbNodes, strategy, this.parserService)

    return TextEdit.replace(lineRange, indent + result)
  }

  private lineIsIfFalseWrapped(lineText: string): string | null {
    const trimmed = lineText.trimStart()
    const indent = this.getIndentation(lineText)

    if (trimmed.startsWith("<% if false %>") && trimmed.endsWith("<% end %>")) {
      const inner = trimmed.slice("<% if false %>".length, -"<% end %>".length)

      return indent + inner
    }

    return null
  }

  private uncommentLine(info: LineInfo, lineText: string, collector: LineContextCollector): TextEdit | null {
    const lineRange = Range.create(info.line, 0, info.line, lineText.length)
    const indent = this.getIndentation(lineText)
    const ifFalseContent = this.lineIsIfFalseWrapped(lineText)

    if (ifFalseContent !== null) {
      return TextEdit.replace(lineRange, ifFalseContent)
    }

    if (info.context === "erb-comment") {
      const node = info.node as ERBContentNode
      if (!node?.tag_opening || !node?.tag_closing) return null

      const contentValue = (node as any).content?.value as string | null
      const trimmedContent = contentValue?.trim() || ""

      if (trimmedContent.startsWith("<") && !trimmedContent.startsWith("<%")) {
        return TextEdit.replace(lineRange, `${indent}${trimmedContent}`)
      }

      if (lspLine(node.tag_opening.location.start) !== info.line) return null

      const erbNodes = collector.erbNodesPerLine.get(info.line) || []

      if (erbNodes.length > 1) {
        const content = lineText.trimStart()
        const result = uncommentLineContent(content, this.parserService)

        return TextEdit.replace(lineRange, indent + result)
      }

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
        const contentStart = commentNode.comment_start.location.end.column
        const contentEnd = commentNode.comment_end.location.start.column
        const innerContent = lineText.substring(contentStart, contentEnd).trim()

        const result = uncommentLineContent(innerContent, this.parserService)

        return TextEdit.replace(lineRange, `${indent}${result}`)
      }
    }

    return null
  }

  private htmlCommentSpansLine(node: HTMLCommentNode, lineText: string): boolean {
    if (!node.comment_start || !node.comment_end) return false

    const commentStart = node.comment_start.location.start.column
    const commentEnd = node.comment_end.location.end.column
    const contentBefore = lineText.substring(0, commentStart).trim()
    const contentAfter = lineText.substring(commentEnd).trim()

    return contentBefore === "" && contentAfter === ""
  }

  private getIndentation(lineText: string): string {
    const match = lineText.match(/^(\s*)/)

    return match ? match[1] : ""
  }
}
