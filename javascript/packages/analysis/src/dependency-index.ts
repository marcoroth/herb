import { collectTemplateDependencies } from "./template-dependencies"
import { isERBBlockNode, isERBCaseNode, isERBContentNode, isERBIfNode, isERBRenderNode, isERBUnlessNode, isHTMLAttributeNode, isHTMLElementNode, isLiteralNode, isRubyParameterNode } from "@herb-tools/core"

const PARSER_OPTIONS = { render_nodes: true, strict_locals: true, prism_nodes: true, prism_program: true, track_whitespace: true }

import type { DependencyOptions } from "./template-dependencies"
import type { DocumentNode, HTMLAttributeNode, HerbBackend, Node, Token } from "@herb-tools/core"

export type AffectedNodeKind = "text_content" | "conditional" | "render" | "attribute_value" | "expression"

export interface AffectedNode {
  nodePath: number[]
  kind: AffectedNodeKind
  expression?: string
  attribute?: string
  location?: string
}

export function referencesState(code: string | undefined, state: string): boolean {
  if (!code || !state) return false

  if (state.startsWith("@")) {
    return new RegExp(`${escapeForPattern(state)}\\b`).test(code)
  }

  if (state.includes(".")) {
    return code.includes(state.split(".")[0])
  }

  return new RegExp(`\\b${escapeForPattern(state)}\\b`).test(code)
}

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function referencesAny(code: string | undefined, aliases: string[]): boolean {
  return aliases.some(alias => referencesState(code, alias))
}

const ASSIGNMENT_NODES = new Set([
  "LocalVariableWriteNode",
  "LocalVariableOrWriteNode",
  "LocalVariableAndWriteNode",
  "LocalVariableOperatorWriteNode",
])

function assignedNames(node: Node, source: string, aliases: string[]): string[] {
  const prism = (node as { prismNode?: unknown }).prismNode as any

  if (!prism) return []

  const names: string[] = []

  const walk = (candidate: any) => {
    if (!candidate) return

    if (ASSIGNMENT_NODES.has(candidate.constructor?.name) && candidate.value?.location) {
      const { startOffset, length } = candidate.value.location
      const right = source.slice(startOffset, startOffset + length)
      const name = String(candidate.name)

      if (referencesAny(right, aliases) && !names.includes(name)) names.push(name)
    }

    for (const child of candidate.compactChildNodes?.() ?? []) walk(child)
  }

  walk(prism)

  return names
}

function blockBindings(node: Node, aliases: string[]): string[] {
  if (!isERBBlockNode(node)) return []
  if (!referencesAny(expressionOf(node), aliases)) return []

  const names: string[] = []

  const walk = (candidate: Node) => {
    if (isRubyParameterNode(candidate)) {
      const name = candidate.name?.value?.trim()

      if (name && !names.includes(name)) names.push(name)
    }

    for (const child of candidate.childNodes()) {
      if (child) walk(child)
    }
  }

  for (const argument of node.block_arguments) {
    if (argument) walk(argument)
  }

  return names.filter(name => !aliases.includes(name))
}

function childrenOf(node: Node): Node[] {
  const indexed = isHTMLElementNode(node)
    ? node.body
    : isERBIfNode(node) || isERBUnlessNode(node)
      ? node.statements
      : isERBBlockNode(node)
        ? node.body
        : node.childNodes()

  return indexed.filter((child): child is Node => child !== null)
}

function attributesOf(node: Node): HTMLAttributeNode[] {
  if (!isHTMLElementNode(node) || !node.open_tag) return []

  return node.open_tag.childNodes().filter((child): child is HTMLAttributeNode => child !== null && isHTMLAttributeNode(child))
}

function locationOf(node: Node): string | undefined {
  const start = node.location?.start

  return start ? `${start.line}:${start.column}` : undefined
}

function expressionOf(node: Node): string | undefined {
  const value = "content" in node ? (node as { content?: Token | null }).content?.value : undefined

  return typeof value === "string" ? value.trim() : undefined
}

function expressionsWithin(node: Node): string[] {
  const own = expressionOf(node)
  const found = own ? [own] : []

  for (const child of childrenOf(node)) found.push(...expressionsWithin(child))

  return found
}

function attributeNameOf(node: HTMLAttributeNode): string | undefined {
  const [first] = node.name?.children ?? []
  const literal = first && isLiteralNode(first) ? first.content : undefined

  return typeof literal === "string" ? literal : undefined
}

export function affectedNodes(backend: HerbBackend, source: string, state: string): AffectedNode[] {
  const document = backend.parse(source, PARSER_OPTIONS).value as DocumentNode
  const affected: AffectedNode[] = []
  const path: number[] = []

  const record = (node: Node, kind: AffectedNodeKind, expression?: string) => {
    affected.push({
      nodePath: [...path],
      kind,
      ...(expression ? { expression } : {}),
      ...(locationOf(node) ? { location: locationOf(node) } : {}),
    })
  }

  const aliases = [state]

  const inspectAttribute = (node: HTMLAttributeNode) => {
    const attribute = attributeNameOf(node)

    for (const value of node.value?.children ?? []) {
      const expression = expressionOf(value)

      if (!referencesAny(expression, aliases)) continue

      affected.push({
        nodePath: [...path],
        kind: "attribute_value",
        ...(expression ? { expression } : {}),
        ...(attribute ? { attribute } : {}),
        ...(locationOf(value) ? { location: locationOf(value) } : {}),
      })
    }
  }

  const walk = (node: Node) => {
    if (isHTMLAttributeNode(node)) {
      inspectAttribute(node)

      return
    }

    for (const attribute of attributesOf(node)) inspectAttribute(attribute)

    if (isERBIfNode(node) || isERBUnlessNode(node) || isERBCaseNode(node)) {
      if (expressionsWithin(node).some(code => referencesAny(code, aliases))) {
        record(node, "conditional", expressionOf(node))
      }
    } else if (isERBContentNode(node) && referencesAny(expressionOf(node), aliases)) {
      record(node, "text_content", expressionOf(node))
    } else if (isERBRenderNode(node) && referencesAny(expressionOf(node), aliases)) {
      record(node, "render", expressionOf(node))
    } else if (isERBBlockNode(node) && referencesAny(expressionOf(node), aliases)) {
      record(node, "expression", expressionOf(node))
    }

    if (isERBContentNode(node)) {
      for (const name of assignedNames(node, source, aliases)) {
        if (!aliases.includes(name)) aliases.push(name)
      }
    }

    const outer = [...aliases]
    const bound = blockBindings(node, aliases)

    aliases.push(...bound)

    for (const [index, child] of childrenOf(node).entries()) {
      path.push(index)
      walk(child)
      path.pop()
    }

    if (bound.length > 0) aliases.splice(0, aliases.length, ...outer)
  }

  for (const [index, child] of childrenOf(document).entries()) {
    path.push(index)
    walk(child)
    path.pop()
  }

  return affected
}

export function dependencyIndex(backend: HerbBackend, file: string, source: string, options: DependencyOptions = {}): Record<string, AffectedNode[]> {
  const dependencies = collectTemplateDependencies(backend, file, source, options)
  const index: Record<string, AffectedNode[]> = {}

  for (const state of [...dependencies.instanceVariables, ...dependencies.constants, ...dependencies.localsDeclared]) {
    const nodes = affectedNodes(backend, source, state)

    if (nodes.length > 0) index[state] = nodes
  }

  return index
}
