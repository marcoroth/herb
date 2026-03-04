import { Position, Range } from "vscode-languageserver/node"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { SerializedPosition, SerializedLocation, Node, Token, ERBNode, HTMLOpenTagNode } from "@herb-tools/core"

export function lspPosition(herbPosition: SerializedPosition): Position {
  return Position.create(herbPosition.line - 1, herbPosition.column)
}

export function lspRangeFromLocation(herbLocation: SerializedLocation): Range {
  return Range.create(lspPosition(herbLocation.start), lspPosition(herbLocation.end))
}

export function erbTagToRange(node: ERBNode): Range | null {
  if (!node.tag_opening || !node.tag_closing) return null

  return Range.create(
    lspPosition(node.tag_opening.location.start),
    lspPosition(node.tag_closing.location.end),
  )
}

export function tokenToRange(token: Token | null): Range | null {
  if (!token) return null

  return lspRangeFromLocation(token.location)
}

export function nodeToRange(node: Node): Range {
  return lspRangeFromLocation(node.location)
}

export function openTagRanges(tag: HTMLOpenTagNode): (Range | null)[] {
  const ranges: (Range | null)[] = []

  if (tag.tag_opening && tag.tag_name) {
    ranges.push(Range.create(
      lspPosition(tag.tag_opening.location.start),
      lspPosition(tag.tag_name.location.end),
    ))
  }

  ranges.push(tokenToRange(tag.tag_closing))

  return ranges
}

/**
 * Returns a Range that spans the entire document
 */
export function getFullDocumentRange(document: TextDocument): Range {
  const lastLine = document.lineCount - 1
  const lastLineText = document.getText({
    start: Position.create(lastLine, 0),
    end: Position.create(lastLine + 1, 0)
  })
  const lastLineLength = lastLineText.length

  return {
    start: Position.create(0, 0),
    end: Position.create(lastLine, lastLineLength)
  }
}
