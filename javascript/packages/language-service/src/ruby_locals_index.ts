import { Range, Position } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor, RubyReferenceCollector } from "@herb-tools/core"
import { StrictLocalsCollector } from "./strict_locals_collector"

import { lspPosition, isPositionInRange, nodeToRange } from "./range_utils"
import { stringIndexFromByteOffset, isERBBlockNode, isERBIterationBlockNode } from "@herb-tools/core"

import type { ParserService } from "./parser_service"
import type { DocumentNode, Node, RubyReference } from "@herb-tools/core"

const PARSER_OPTIONS = { prism_program: true, strict_locals: true } as const

export interface RubyLocal {
  name: string
  declaration: Range
  usages: Range[]
}

export class RubyLocalsIndex {
  readonly locals: RubyLocal[]

  private constructor(locals: RubyLocal[]) {
    this.locals = locals
  }

  static build(parserService: ParserService, textDocument: TextDocument): RubyLocalsIndex {
    const text = textDocument.getText()

    const result = parserService.parseContent(text, PARSER_OPTIONS)
    if (result.failed) return new RubyLocalsIndex([])

    const document = result.value as DocumentNode
    if (!document.prismNode) return new RubyLocalsIndex([])

    const references = new RubyReferenceCollector()

    references.visit(document.prismNode)

    const toRange = (reference: RubyReference) => referenceRange(reference, textDocument, text)

    return new RubyLocalsIndex([
      ...strictLocals(document, references, toRange),
      ...blockLocals(document, references, toRange)
    ])
  }

  at(position: Position): RubyLocal | null {
    let best: RubyLocal | null = null

    for (const local of this.locals) {
      if (!isPositionInRange(position, local.declaration) && !local.usages.some(usage => isPositionInRange(position, usage))) continue
      if (!best || encloses(best.declaration, local.declaration)) best = local
    }

    return best
  }
}

function strictLocals(document: DocumentNode, references: RubyReferenceCollector, toRange: (reference: RubyReference) => Range): RubyLocal[] {
  const collector = new StrictLocalsCollector()

  collector.visit(document)

  return collector.declarations.map(declaration => ({
    name: declaration.name,
    declaration: nameRange(declaration.location.start, declaration.name),
    usages: references.bareCalls.filter(call => call.name === declaration.name).map(toRange)
  }))
}

function blockLocals(document: DocumentNode, references: RubyReferenceCollector, toRange: (reference: RubyReference) => Range): RubyLocal[] {
  const blocks = blockRanges(document)

  return references.localBindings.map(binding => {
    const range = toRange(binding)
    const scope = innermostEnclosing(blocks, range)
    const usages = references.localReads.filter(read => read.name === binding.name).map(toRange).filter(usage => !scope || encloses(scope, usage))

    return { name: binding.name, declaration: range, usages }
  })
}

function blockRanges(document: DocumentNode): Range[] {
  const collector = new BlockRangeCollector()

  collector.visit(document)

  return collector.ranges
}

class BlockRangeCollector extends Visitor {
  readonly ranges: Range[] = []

  visitChildNodes(node: Node): void {
    if (isERBBlockNode(node) || isERBIterationBlockNode(node)) this.ranges.push(nodeToRange(node))

    super.visitChildNodes(node)
  }
}

function innermostEnclosing(ranges: Range[], inner: Range): Range | null {
  let best: Range | null = null

  for (const range of ranges) {
    if (!encloses(range, inner)) continue
    if (!best || encloses(best, range)) best = range
  }

  return best
}

function encloses(outer: Range, inner: Range): boolean {
  return isPositionInRange(inner.start, outer) && isPositionInRange(inner.end, outer)
}

function nameRange(start: { line: number, column: number }, name: string): Range {
  const from = lspPosition(start)

  return Range.create(from, Position.create(from.line, from.character + name.length))
}

function referenceRange(reference: RubyReference, textDocument: TextDocument, text: string): Range {
  const start = stringIndexFromByteOffset(text, reference.startOffset)
  const end = stringIndexFromByteOffset(text, reference.startOffset + reference.length)

  return Range.create(textDocument.positionAt(start), textDocument.positionAt(end))
}
