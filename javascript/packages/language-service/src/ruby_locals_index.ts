import { Range, Position } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor, RubyReferenceCollector, stringIndexFromByteOffset, isERBBlockNode, isERBIterationBlockNode } from "@herb-tools/core"

import { StrictLocalsCollector } from "./strict_locals_collector"
import { lspPosition, isPositionInRange, nodeToRange } from "./range_utils"

import type { ParserService } from "./parser_service"
import type { DocumentNode, Node, RubyReference } from "@herb-tools/core"

/**
 * Reading the Ruby needs the whole program, which the parser only assembles
 * when asked, so this is deliberately not the parse everything else runs on.
 */
const PARSER_OPTIONS = { prism_program: true, strict_locals: true } as const

export interface RubyLocal {
  name: string

  /** Where the name is introduced, either a strict local or a block parameter. */
  binding: Range

  /** Every place that binding is read. */
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

  /**
   * The local the position sits on, whether that is where it is bound or one of
   * the places it is read. The innermost binding wins, so a block parameter
   * shadowing a strict local answers for the positions inside the block.
   */
  at(position: Position): RubyLocal | null {
    let best: RubyLocal | null = null

    for (const local of this.locals) {
      if (!isPositionInRange(position, local.binding) && !local.usages.some(usage => isPositionInRange(position, usage))) continue
      if (!best || encloses(best.binding, local.binding)) best = local
    }

    return best
  }
}

/**
 * A strict local is never assigned in the template, so Ruby reads it as a bare
 * method call. That is also what keeps a block parameter of the same name out
 * of the group, since inside the block the name resolves to a real local.
 */
function strictLocals(document: DocumentNode, references: RubyReferenceCollector, toRange: (reference: RubyReference) => Range): RubyLocal[] {
  const collector = new StrictLocalsCollector()

  collector.visit(document)

  return collector.declarations.map(declaration => ({
    name: declaration.name,
    binding: nameRange(declaration.location.start, declaration.name),
    usages: references.bareCalls.filter(call => call.name === declaration.name).map(toRange)
  }))
}

/**
 * A block parameter is scoped to its block, so two blocks taking the same
 * parameter name stay separate groups rather than collapsing into one.
 */
function blockLocals(document: DocumentNode, references: RubyReferenceCollector, toRange: (reference: RubyReference) => Range): RubyLocal[] {
  const blocks = blockRanges(document)

  return references.localBindings.map(binding => {
    const range = toRange(binding)
    const scope = innermostEnclosing(blocks, range)

    const usages = references.localReads
      .filter(read => read.name === binding.name)
      .map(toRange)
      .filter(usage => !scope || encloses(scope, usage))

    return { name: binding.name, binding: range, usages }
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
