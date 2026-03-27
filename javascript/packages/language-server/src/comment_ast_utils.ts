import { ParserService } from "./parser_service"
import { LineContextCollector } from "./line_context_collector"

import { HTMLCommentNode, Location, createSyntheticToken } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import { isERBCommentNode, isLiteralNode, createLiteral } from "@herb-tools/core"
import { asMutable } from "@herb-tools/rewriter"

import type { Node, ERBContentNode } from "@herb-tools/core"

/**
 * Commenting strategy for a line:
 * - "single-erb": sole ERB tag on the line → insert # at column offset
 * - "all-erb": multiple ERB tags with no significant HTML → # into each
 * - "per-segment": control-flow ERB wrapping HTML → # each ERB, <!-- --> each HTML segment
 * - "whole-line": output ERB mixed with HTML → wrap entire line in <!-- --> with ERB #
 * - "html-only": pure HTML content → wrap in <!-- -->
 */
export type CommentStrategy = "single-erb" | "all-erb" | "per-segment" | "whole-line" | "html-only"

interface LineSegment {
  text: string
  isERB: boolean
  node?: ERBContentNode
}

export function commentERBNode(node: ERBContentNode): void {
  const mutable = asMutable(node)

  if (mutable.tag_opening) {
    const currentValue = mutable.tag_opening.value

    mutable.tag_opening = createSyntheticToken(
      currentValue.substring(0, 2) + "#" + currentValue.substring(2),
      mutable.tag_opening.type
    )
  }
}

export function uncommentERBNode(node: ERBContentNode): void {
  const mutable = asMutable(node)

  if (mutable.tag_opening && mutable.tag_opening.value === "<%#") {
    const contentValue = mutable.content?.value || ""

    if (
      contentValue.startsWith(" graphql ") ||
      contentValue.startsWith(" %= ") ||
      contentValue.startsWith(" == ") ||
      contentValue.startsWith(" % ") ||
      contentValue.startsWith(" = ") ||
      contentValue.startsWith(" - ")
    ) {
      mutable.tag_opening = createSyntheticToken("<%", mutable.tag_opening.type)
      mutable.content = createSyntheticToken(contentValue.substring(1), mutable.content!.type)
    } else {
      mutable.tag_opening = createSyntheticToken("<%", mutable.tag_opening.type)
    }
  }
}

export function determineStrategy(erbNodes: ERBContentNode[], lineText: string): CommentStrategy {
  if (erbNodes.length === 0) {
    return "html-only"
  }

  if (erbNodes.length === 1) {
    const node = erbNodes[0]
    if (!node.tag_opening || !node.tag_closing) return "html-only"

    const nodeStart = node.tag_opening.location.start.column
    const nodeEnd = node.tag_closing.location.end.column
    const isSoleContent = lineText.substring(0, nodeStart).trim() === "" && lineText.substring(nodeEnd).trim() === ""

    if (isSoleContent) {
      return "single-erb"
    }

    return "whole-line"
  }

  const segments = getLineSegments(lineText, erbNodes)
  const hasHTML = segments.some(segment => !segment.isERB && segment.text.trim() !== "")

  if (!hasHTML) {
    return "all-erb"
  }

  const allControlTags = erbNodes.every(node => node.tag_opening?.value === "<%")

  if (allControlTags) {
    return "per-segment"
  }

  return "whole-line"
}

function getLineSegments(lineText: string, erbNodes: ERBContentNode[]): LineSegment[] {
  const segments: LineSegment[] = []
  const sorted = [...erbNodes].sort((a, b) => a.tag_opening!.location.start.column - b.tag_opening!.location.start.column)

  let position = 0

  for (const node of sorted) {
    const nodeStart = node.tag_opening!.location.start.column
    const nodeEnd = node.tag_closing!.location.end.column

    if (nodeStart > position) {
      segments.push({ text: lineText.substring(position, nodeStart), isERB: false })
    }

    segments.push({ text: lineText.substring(nodeStart, nodeEnd), isERB: true, node })
    position = nodeEnd
  }

  if (position < lineText.length) {
    segments.push({ text: lineText.substring(position), isERB: false })
  }

  return segments
}

/**
 * Comment a line using AST mutation for strategies where the parser produces flat children,
 * and text-segment manipulation for per-segment (where the parser nests nodes).
 */
export function commentLineContent(content: string, erbNodes: ERBContentNode[], strategy: CommentStrategy, parserService: ParserService): string {
  if (strategy === "per-segment") {
    return commentPerSegment(content, erbNodes)
  }

  const parseResult = parserService.parseContent(content, { track_whitespace: true })
  const lineCollector = new LineContextCollector()
  parseResult.visit(lineCollector)

  const lineERBNodes = lineCollector.erbNodesPerLine.get(0) || []
  const document = parseResult.value
  const children = asMutable(document).children

  switch (strategy) {
    case "all-erb":
      for (const node of lineERBNodes) {
        commentERBNode(node)
      }
      break

    case "whole-line": {
      for (const node of lineERBNodes) {
        commentERBNode(node)
      }

      const commentNode = new HTMLCommentNode({
        type: "AST_HTML_COMMENT_NODE",
        location: Location.zero,
        errors: [],
        comment_start: createSyntheticToken("<!--", "TOKEN_HTML_COMMENT_START"),
        children: [createLiteral(" "), ...(children.slice() as Node[]), createLiteral(" ")],
        comment_end: createSyntheticToken("-->", "TOKEN_HTML_COMMENT_END"),
      })

      children.length = 0
      children.push(commentNode)
      break
    }

    case "html-only": {
      const commentNode = new HTMLCommentNode({
        type: "AST_HTML_COMMENT_NODE",
        location: Location.zero,
        errors: [],
        comment_start: createSyntheticToken("<!--", "TOKEN_HTML_COMMENT_START"),
        children: [createLiteral(" "), ...(children.slice() as Node[]), createLiteral(" ")],
        comment_end: createSyntheticToken("-->", "TOKEN_HTML_COMMENT_END"),
      })

      children.length = 0
      children.push(commentNode)
      break
    }
  }

  return IdentityPrinter.print(document, { ignoreErrors: true })
}

/**
 * Per-segment commenting uses text segments because the parser creates nested
 * structures (e.g., ERBIfNode) that don't allow flat child iteration.
 */
function commentPerSegment(content: string, erbNodes: ERBContentNode[]): string {
  const segments = getLineSegments(content, erbNodes)

  return segments.map(segment => {
    if (segment.isERB) {
      return segment.text.substring(0, 2) + "#" + segment.text.substring(2)
    } else if (segment.text.trim() !== "") {
      return `<!-- ${segment.text} -->`
    }

    return segment.text
  }).join("")
}

export function uncommentLineContent(content: string, parserService: ParserService): string {
  const parseResult = parserService.parseContent(content, { track_whitespace: true })
  const lineCollector = new LineContextCollector()

  parseResult.visit(lineCollector)

  const lineERBNodes = lineCollector.erbNodesPerLine.get(0) || []
  const document = parseResult.value
  const children = asMutable(document).children

  for (const node of lineERBNodes) {
    if (isERBCommentNode(node)) {
      uncommentERBNode(node)
    }
  }

  let index = 0

  while (index < children.length) {
    const child = children[index]

    if (child.type === "AST_HTML_COMMENT_NODE") {
      const commentNode = child as HTMLCommentNode
      const innerChildren = [...commentNode.children]

      if (innerChildren.length > 0) {
        const first = innerChildren[0]

        if (isLiteralNode(first) && first.content.startsWith(" ")) {
          const trimmed = first.content.substring(1)

          if (trimmed === "") {
            innerChildren.shift()
          } else {
            innerChildren[0] = createLiteral(trimmed)
          }
        }
      }

      if (innerChildren.length > 0) {
        const last = innerChildren[innerChildren.length - 1]

        if (isLiteralNode(last) && last.content.endsWith(" ")) {
          const trimmed = last.content.substring(0, last.content.length - 1)

          if (trimmed === "") {
            innerChildren.pop()
          } else {
            innerChildren[innerChildren.length - 1] = createLiteral(trimmed)
          }
        }
      }

      const innerERBNodes: ERBContentNode[] = []
      const innerCollector = new LineContextCollector()

      for (const innerChild of innerChildren) {
        innerCollector.visit(innerChild)
      }

      innerERBNodes.push(...(innerCollector.erbNodesPerLine.get(0) || []))

      for (const erbNode of innerERBNodes) {
        if (isERBCommentNode(erbNode)) {
          uncommentERBNode(erbNode)
        }
      }

      children.splice(index, 1, ...innerChildren)
      index += innerChildren.length

      continue
    }

    index++
  }

  return IdentityPrinter.print(document, { ignoreErrors: true })
}
