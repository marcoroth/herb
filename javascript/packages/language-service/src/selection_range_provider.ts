import { SelectionRange, Position, Range } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { isHTMLElementNode } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"

import { ParserService } from "./parser_service"
import { nodeToRange, lspPosition } from "./range_utils"

function containsPosition(node: Node, position: Position): boolean {
  const start = node.location.start
  const end = node.location.end

  const startLine = start.line - 1
  const endLine = end.line - 1

  if (position.line < startLine || position.line > endLine) return false
  if (position.line === startLine && position.character < start.column) return false
  if (position.line === endLine && position.character > end.column) return false

  return true
}

function collectAncestors(node: Node, position: Position, path: Node[]): void {
  path.push(node)

  for (const child of node.compactChildNodes()) {
    if (containsPosition(child, position)) {
      collectAncestors(child, position, path)
      return
    }
  }
}

function elementContentRange(node: Node): Range | null {
  if (!isHTMLElementNode(node)) return null
  if (!node.open_tag || !node.close_tag) return null

  return Range.create(lspPosition(node.open_tag.location.end), lspPosition(node.close_tag.location.start))
}

function containsRange(outer: Range, position: Position): boolean {
  if (position.line < outer.start.line || position.line > outer.end.line) return false
  if (position.line === outer.start.line && position.character < outer.start.character) return false
  if (position.line === outer.end.line && position.character > outer.end.character) return false

  return true
}

function sameRange(a: Range, b: Range): boolean {
  return a.start.line === b.start.line
    && a.start.character === b.start.character
    && a.end.line === b.end.line
    && a.end.character === b.end.character
}

function enclosesRange(outer: Range, inner: Range): boolean {
  return containsRange(outer, inner.start) && containsRange(outer, inner.end)
}

function buildSelectionRange(node: Node, position: Position): SelectionRange {
  const path: Node[] = []
  collectAncestors(node, position, path)

  const ranges: Range[] = []

  for (const ancestor of path) {
    ranges.push(nodeToRange(ancestor))

    const content = elementContentRange(ancestor)

    if (content && containsRange(content, position)) ranges.push(content)
  }

  const nested: Range[] = []

  for (let index = ranges.length - 1; index >= 0; index--) {
    const range = ranges[index]
    const inner = nested[nested.length - 1]

    if (inner && (sameRange(range, inner) || !enclosesRange(range, inner))) continue

    nested.push(range)
  }

  let current: SelectionRange | undefined

  for (let index = nested.length - 1; index >= 0; index--) {
    current = SelectionRange.create(nested[index], current)
  }

  return current!
}

export class SelectionRangeProvider {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getSelectionRanges(textDocument: TextDocument, positions: Position[]): SelectionRange[] {
    const parseResult = this.parserService.parseDocument(textDocument)

    return positions.map(position =>
      buildSelectionRange(parseResult.document, position)
    )
  }
}
