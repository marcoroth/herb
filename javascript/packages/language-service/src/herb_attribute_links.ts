import { Range, Position } from "vscode-languageserver-types"

import { Visitor } from "@herb-tools/core"
import { HERB_ATTRIBUTES, ACTION_NAMES, splitOutsideQuotes, parseStateDirective } from "@herb-tools/client/directives"

import { lspPosition } from "./range_utils"

import type { ActionName, StateSignature } from "@herb-tools/client/directives"
import type { DocumentNode, Node, HTMLAttributeNode, LiteralNode, ERBContentNode } from "@herb-tools/core"

export interface AttributeStateUsage {
  name: string
  range: Range
}

export interface SlotNameGroup {
  name: string
  declarations: Range[]
  usages: Range[]
}

export interface HerbAttributeLinks {
  stateUsages: AttributeStateUsage[]
  slotNames: SlotNameGroup[]
}

const ACTION_ATTRIBUTES = new Map<string, ActionName>(ACTION_NAMES.map(action => [HERB_ATTRIBUTES[action], action]))

export function collectHerbAttributes(document: DocumentNode): HerbAttributeLinks {
  const collector = new HerbAttributeCollector()

  collector.visit(document)

  const groups = new Map<string, SlotNameGroup>()

  const groupFor = (name: string): SlotNameGroup => {
    const existing = groups.get(name)

    if (existing) return existing

    const group = { name, declarations: [], usages: [] }

    groups.set(name, group)

    return group
  }

  for (const { name, range } of collector.slotDeclarations) groupFor(name).declarations.push(range)
  for (const { name, range } of collector.slotUsages) groupFor(name).usages.push(range)

  return { stateUsages: collector.stateUsages, slotNames: [...groups.values()].filter(group => group.declarations.length > 0 || group.usages.length > 0) }
}

class HerbAttributeCollector extends Visitor {
  readonly stateUsages: AttributeStateUsage[] = []
  readonly slotDeclarations: AttributeStateUsage[] = []
  readonly slotUsages: AttributeStateUsage[] = []

  visitChildNodes(node: Node): void {
    if (node.type === "AST_HTML_ATTRIBUTE_NODE") this.collect(node as HTMLAttributeNode)

    super.visitChildNodes(node)
  }

  private collect(attribute: HTMLAttributeNode): void {
    const attributeName = staticText(attribute.name?.children)
    const literal = singleLiteral(attribute.value?.children)

    if (attributeName === null || literal === null) return

    const action = ACTION_ATTRIBUTES.get(attributeName)

    if (action) {
      for (const { name, offset } of stateNamesIn(literal.content ?? "", action)) {
        this.stateUsages.push({ name, range: literalRange(literal, offset, name.length) })
      }

      return
    }

    if (attributeName === HERB_ATTRIBUTES.name || attributeName === HERB_ATTRIBUTES.into) {
      const value = (literal.content ?? "").trim()

      if (value === "") return

      if (attributeName === HERB_ATTRIBUTES.name) {
        const offset = (literal.content ?? "").indexOf(value)

        this.slotDeclarations.push({ name: value, range: literalRange(literal, offset, value.length) })
      } else {
        this.slotUsages.push({ name: value, range: attributeRange(attribute) })
      }
    }
  }
}

function stateNamesIn(content: string, action: ActionName): { name: string, offset: number }[] {
  const found: { name: string, offset: number }[] = []
  let cursor = 0

  for (const part of splitOutsideQuotes(content, " ")) {
    if (part.trim() === "") {
      cursor += part.length + 1

      continue
    }

    const partOffset = content.indexOf(part, cursor)

    if (partOffset === -1) continue

    const arrow = part.indexOf("->")
    const restOffset = arrow === -1 ? partOffset : partOffset + arrow + 2
    const rest = arrow === -1 ? part : part.slice(arrow + 2)

    let nameCursor = restOffset

    for (const piece of splitOutsideQuotes(rest, ",")) {
      const separator = piece.indexOf("=")
      const raw = action === "set" ? (separator === -1 ? piece : piece.slice(0, separator)) : piece
      const name = raw.trim()

      if (name !== "" && /^[a-z_][a-zA-Z0-9_]*$/.test(name)) {
        const offset = content.indexOf(name, nameCursor)

        if (offset !== -1) {
          found.push({ name, offset })
          nameCursor = offset + name.length
        }
      } else {
        nameCursor += piece.length + 1
      }
    }

    cursor = partOffset + part.length
  }

  return found
}

function singleLiteral(children: Node[] | undefined): LiteralNode | null {
  if (!children || children.length !== 1) return null

  const child = children[0]

  return child.type === "AST_LITERAL_NODE" ? (child as LiteralNode) : null
}

function staticText(children: Node[] | undefined): string | null {
  const literal = singleLiteral(children)

  return literal ? (literal.content ?? "") : null
}

function attributeRange(attribute: HTMLAttributeNode): Range {
  return Range.create(lspPosition(attribute.location.start), lspPosition(attribute.location.end))
}

function literalRange(literal: LiteralNode, offset: number, length: number): Range {
  const before = (literal.content ?? "").slice(0, offset)
  const lines = before.split("\n")
  const line = literal.location.start.line + lines.length - 1
  const column = lines.length === 1 ? literal.location.start.column + before.length : lines[lines.length - 1].length
  const from = lspPosition({ line, column })

  return Range.create(from, Position.create(from.line, from.character + length))
}

export interface StateDirectiveEntry {
  node: ERBContentNode
  signature: StateSignature
  scope: Node | null
}

export function collectStateDirectives(document: DocumentNode): StateDirectiveEntry[] {
  const collector = new StateDirectiveCollector()

  collector.visit(document)

  return collector.entries
}

class StateDirectiveCollector extends Visitor {
  readonly entries: StateDirectiveEntry[] = []

  private stack: Node[] = []

  visitChildNodes(node: Node): void {
    if (node.type === "AST_ERB_CONTENT_NODE") {
      const content = node as ERBContentNode

      if (content.tag_opening?.value === "<%#") {
        const signature = parseStateDirective(content.content?.value ?? "")

        if (signature && !signature.malformed) {
          this.entries.push({ node: content, signature, scope: this.stack[this.stack.length - 1] ?? null })
        }
      }
    }

    const scoping = node.type === "AST_ERB_BLOCK_NODE" || node.type === "AST_ERB_ITERATION_BLOCK_NODE"

    if (scoping) this.stack.push(node)

    super.visitChildNodes(node)

    if (scoping) this.stack.pop()
  }
}

export function slotNameGroupAt(links: HerbAttributeLinks, position: Position, covers: (position: Position, range: Range) => boolean): SlotNameGroup | null {
  for (const group of links.slotNames) {
    if ([...group.declarations, ...group.usages].some(range => covers(position, range))) return group
  }

  return null
}
