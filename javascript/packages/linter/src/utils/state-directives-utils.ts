import { Visitor } from "@herb-tools/core"
import { isStateDirectiveContent, mentionsAnyState, parseStateDirective, slotsDirectiveModeOf } from "@herb-tools/client/directives"
import { ACTION_NAMES, ACTION_SCHEMA, HERB_ATTRIBUTES } from "@herb-tools/client/directives"

import type { ERBBlockNode, ERBContentNode, ERBIfNode, Node } from "@herb-tools/core"
import type { ActionName, ActionSchema, Clause, StateDeclaration, StateSignature } from "@herb-tools/client/directives"

export type ActionClause = Clause
export type ActionAttribute = (typeof HERB_ATTRIBUTES)[ActionName]

export const ACTION_ATTRIBUTE_SCHEMA = Object.fromEntries(
  ACTION_NAMES.map((name) => [HERB_ATTRIBUTES[name], ACTION_SCHEMA[name]]),
) as Record<ActionAttribute, ActionSchema>

export const BY_ATTRIBUTE = HERB_ATTRIBUTES.by

export function isActionAttribute(name: string): name is ActionAttribute {
  return name in ACTION_ATTRIBUTE_SCHEMA
}

export function isERBComment(node: ERBContentNode): boolean {
  return node.tag_opening?.value === "<%#"
}

export function isStateDirective(node: ERBContentNode): boolean {
  if (!isERBComment(node)) return false

  return isStateDirectiveContent(node.content?.value ?? "")
}

export function stateSignatureOf(node: ERBContentNode): StateSignature | null {
  if (!isERBComment(node)) return null

  const content = node.content?.value

  if (content === undefined) return null

  return parseStateDirective(content)
}

export function slotsDirectiveMode(node: ERBContentNode): "server" | "client" | null {
  if (!isERBComment(node)) return null

  return slotsDirectiveModeOf(node.content?.value ?? "")
}

export function isDerived(declaration: StateDeclaration): boolean {
  return declaration.derived !== undefined && declaration.derived !== null && typeof declaration.derived === "object"
}

export function declaredKind(declaration: StateDeclaration): "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded" {
  if (declaration.derived !== undefined && declaration.derived !== null && typeof declaration.derived === "object") {
    return declaration.derived.kind
  }

  switch (declaration.kind) {
    case "boolean":
    case "integer":
    case "string":
    case "symbol":
    case "nil":
      return declaration.kind
    default:
      return "seeded"
  }
}

export function kindWithArticle(kind: string): string {
  const capitalized = kind.charAt(0).toUpperCase() + kind.slice(1)

  return kind === "integer" ? `an ${capitalized}` : `a ${capitalized}`
}

export class StateScopeMap {
  #scopes = new Map<unknown, Map<string, StateDeclaration>>()

  static collect(root: Node): StateScopeMap {
    const map = new StateScopeMap()
    const collector = new StateScopeCollector(map)

    collector.visit(root)

    return map
  }

  get hasDeclarations(): boolean {
    for (const declarations of this.#scopes.values()) {
      if (declarations.size > 0) return true
    }

    return false
  }

  declare(scope: unknown, declaration: StateDeclaration): void {
    const declarations = this.#scopes.get(scope) ?? new Map<string, StateDeclaration>()

    if (!declarations.has(declaration.name)) declarations.set(declaration.name, declaration)

    this.#scopes.set(scope, declarations)
  }

  resolve(stack: readonly unknown[], name: string): StateDeclaration | undefined {
    for (let position = stack.length - 1; position >= 0; position -= 1) {
      const declaration = this.#scopes.get(stack[position])?.get(name)

      if (declaration) return declaration
    }

    return undefined
  }

  allNames(): string[] {
    const collected = new Set<string>()

    for (const declarations of this.#scopes.values()) {
      for (const name of declarations.keys()) {
        collected.add(name)
      }
    }

    return [...collected]
  }

  namesIn(stack: readonly unknown[]): string[] {
    const collected = new Set<string>()

    for (const scope of stack) {
      for (const name of this.#scopes.get(scope)?.keys() ?? []) {
        collected.add(name)
      }
    }

    return [...collected]
  }
}

// TODO: scopes approximate the engine's placement rule with ERB blocks; the engine scopes
// item states to keyed collection bodies specifically, so a directive inside a non-collection
// block is treated as item-scoped here and as region-scoped by the engine.
class StateScopeCollector extends Visitor {
  #map: StateScopeMap
  #stack: unknown[] = [null]

  constructor(map: StateScopeMap) {
    super()

    this.#map = map
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.#stack.push(node)

    super.visitERBBlockNode(node)

    this.#stack.pop()
  }

  visitERBContentNode(node: ERBContentNode): void {
    const parsed = stateSignatureOf(node)

    if (!parsed || parsed.malformed) return

    for (const declaration of parsed.declarations) {
      this.#map.declare(this.#stack[this.#stack.length - 1], declaration)
    }
  }
}

const FOLD_OPERATOR = /^([a-z_][a-zA-Z0-9_]*)\s*\+=\s*(-?\d+)$/
const FOLD_ASSIGNMENT = /^([a-z_][a-zA-Z0-9_]*)\s*=\s*([a-z_][a-zA-Z0-9_]*)\s*\+\s*(-?\d+)$/
const BLANK_TYPES = new Set(["AST_WHITESPACE_NODE", "AST_HTML_TEXT_NODE", "AST_LITERAL_NODE"])

export interface FoldIncrement {
  name: string
  by: number
}

export interface CountedFold {
  name: string
  by: number
  anchor: ERBIfNode | ERBContentNode
  assignment: ERBContentNode
  block: ERBBlockNode
}

export function foldIncrementOf(source: string): FoldIncrement | null {
  const trimmed = source.trim()
  const operator = FOLD_OPERATOR.exec(trimmed)

  if (operator) return { name: operator[1], by: Number(operator[2]) }

  const assignment = FOLD_ASSIGNMENT.exec(trimmed)

  if (assignment && assignment[1] === assignment[2]) return { name: assignment[1], by: Number(assignment[3]) }

  return null
}

export function collectCountedFolds(root: Node, states: StateScopeMap): CountedFold[] {
  const collector = new CountedFoldCollector(states)

  collector.visit(root)

  return collector.folds
}

class CountedFoldCollector extends Visitor {
  readonly folds: CountedFold[] = []

  #states: StateScopeMap
  #stack: (ERBBlockNode | null)[] = [null]
  #blockDepths: number[] = []
  #containerDepth = 0

  constructor(states: StateScopeMap) {
    super()

    this.#states = states
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.#stack.push(node)
    this.#blockDepths.push(this.#containerDepth + 1)
    this.#containerDepth += 1

    super.visitERBBlockNode(node)

    this.#containerDepth -= 1
    this.#blockDepths.pop()
    this.#stack.pop()
  }

  visitERBIfNode(node: ERBIfNode): void {
    const fold = this.#foldConditional(node)

    if (fold) {
      this.folds.push(fold)

      return
    }

    this.#containerDepth += 1
    super.visitERBIfNode(node)
    this.#containerDepth -= 1
  }

  visitERBUnlessNode(node: Node): void {
    this.#containerDepth += 1
    super.visitERBUnlessNode(node as never)
    this.#containerDepth -= 1
  }

  visitERBCaseNode(node: Node): void {
    this.#containerDepth += 1
    super.visitERBCaseNode(node as never)
    this.#containerDepth -= 1
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%") return
    if (!this.#directlyInBlock()) return

    const increment = foldIncrementOf(node.content?.value ?? "")

    if (!increment) return
    if (!this.#states.resolve(this.#stack, increment.name)) return

    const block = this.#stack[this.#stack.length - 1]

    if (!block) return

    this.folds.push({ name: increment.name, by: increment.by, anchor: node, assignment: node, block })
  }

  #foldConditional(node: ERBIfNode): CountedFold | null {
    if (node.subsequent) return null
    if (!this.#directlyInBlock()) return null

    const block = this.#stack[this.#stack.length - 1]

    if (!block) return null

    const significant = (node.statements ?? []).filter((child) => !BLANK_TYPES.has(child.type) || contentOf(child).trim() !== "")

    if (significant.length !== 1) return null

    const assignment = significant[0]

    if (assignment.type !== "AST_ERB_CONTENT_NODE") return null

    const tag = assignment as ERBContentNode

    if (tag.tag_opening?.value !== "<%") return null

    const increment = foldIncrementOf(tag.content?.value ?? "")

    if (!increment) return null
    if (!this.#states.resolve(this.#stack, increment.name)) return null

    const condition = (node.content?.value ?? "").trim().replace(/^if\b/, "").trim()

    if (!mentionsAnyState(condition, this.#states.namesIn(this.#stack))) return null

    return { name: increment.name, by: increment.by, anchor: node, assignment: tag, block }
  }

  #directlyInBlock(): boolean {
    return this.#blockDepths.length > 0 && this.#containerDepth === this.#blockDepths[this.#blockDepths.length - 1]
  }
}

function contentOf(node: Node): string {
  const content = (node as { content?: string | { value?: string } }).content

  if (typeof content === "string") return content

  return content?.value ?? ""
}
