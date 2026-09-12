import { Location } from "./location.js"

import type { Position } from "./position.js"
import type { ParseResult } from "./parse-result.js"
import type { Node, DocumentNode } from "./nodes.js"

export type LocateSource = Node | DocumentNode | ParseResult

export class LocateResult {
  readonly node: Node
  readonly ancestors: Node[]

  constructor(node: Node, ancestors: Node[]) {
    this.node = node
    this.ancestors = ancestors
  }

  innermost<T extends Node>(predicate: (node: Node) => node is T): T | null
  innermost(predicate: (node: Node) => boolean): Node | null
  innermost(predicate: (node: Node) => boolean): Node | null {
    if (predicate(this.node)) return this.node

    return this.ancestors.find(predicate) ?? null
  }

  get path(): Node[] {
    return [...this.ancestors].reverse().concat(this.node)
  }
}

function root(source: LocateSource): Node {
  return "value" in source ? (source.value as Node) : source
}

function contains(node: Node, position: Position): boolean {
  const location = node.location

  if (!location || location.isEmpty()) {
    return false
  }

  return location.contains(position)
}

function union(first: Location | null, second: Location): Location {
  if (!first) return second

  return new Location(
    first.start.compare(second.start) <= 0 ? first.start : second.start,
    first.end.compare(second.end) >= 0 ? first.end : second.end,
  )
}

function extent(node: Node, extents: Map<Node, Location | null>): Location | null {
  const cached = extents.get(node)
  if (cached !== undefined) return cached

  extents.set(node, null)

  const own = node.location && !node.location.isEmpty() ? node.location : null

  const found = node.compactChildNodes().reduce<Location | null>((accumulator, child) => {
    const childExtent = extent(child, extents)

    return childExtent ? union(accumulator, childExtent) : accumulator
  }, own)

  extents.set(node, found)

  return found
}

function withinExtent(node: Node, position: Position, extents: Map<Node, Location | null>): boolean {
  const found = extent(node, extents)

  return found !== null && found.contains(position)
}

export function locatable(source: LocateSource, position: Position): boolean {
  return withinExtent(root(source), position, new Map())
}

export function locate(source: LocateSource, position: Position): LocateResult | null {
  const extents = new Map<Node, Location | null>()
  const start = root(source)

  if (!withinExtent(start, position, extents)) return null

  let current = start
  let ancestors: Node[] = []

  for (;;) {
    const child = current.compactChildNodes().find((candidate) => withinExtent(candidate, position, extents))

    if (child) {
      ancestors = [current, ...ancestors]
      current = child

      continue
    }

    if (contains(current, position)) {
      return new LocateResult(current, ancestors)
    }

    const nearest = ancestors.findIndex((ancestor) => contains(ancestor, position))

    if (nearest === -1) return null

    return new LocateResult(ancestors[nearest], ancestors.slice(nearest + 1))
  }
}
