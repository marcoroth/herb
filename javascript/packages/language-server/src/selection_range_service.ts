import { SelectionRange, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import type { Node } from "@herb-tools/core"

import { ParserService } from "./parser_service"
import { nodeToRange } from "./range_utils"

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

function buildSelectionRange(node: Node, position: Position): SelectionRange {
  const path: Node[] = []
  collectAncestors(node, position, path)

  // Build linked list from outermost to innermost
  let current: SelectionRange | undefined

  for (const ancestor of path) {
    current = SelectionRange.create(nodeToRange(ancestor), current)
  }

  return current!
}

export class SelectionRangeService {
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
