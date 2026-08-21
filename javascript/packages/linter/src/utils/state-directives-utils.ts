import { Visitor } from "@herb-tools/core"
import { isStateDirectiveContent, parseStateDirective, slotsDirectiveModeOf } from "@herb-tools/client/directives"
import { ACTION_NAMES, ACTION_SCHEMA, HERB_ATTRIBUTES } from "@herb-tools/client/directives"

import type { ERBBlockNode, ERBContentNode, Node } from "@herb-tools/core"
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

export function declaredKind(declaration: StateDeclaration): "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded" {
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
