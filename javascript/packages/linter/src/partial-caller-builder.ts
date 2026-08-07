import picomatch from "picomatch"

import { glob } from "tinyglobby"
import { join } from "node:path"
import { readFileSync } from "node:fs"

import { TEMPLATE_GLOB_PATTERN, isPrismNodeType, isRubyRenderLocalNode } from "@herb-tools/core"
import { isOutputRender, renderPartialExpression } from "./rules/prism-rule-utils.js"

import { PartialCallerIndex } from "@herb-tools/core"

import type { ERBRenderNode, HerbBackend, Node, PartialCallSite, PartialIndex, SerializedPartialCallerIndex } from "@herb-tools/core"

const RENDER_MARKER = "render"
const PARSER_OPTIONS = { render_nodes: true, prism_nodes: true } as const

export interface PartialCallerIndexOptions {
  include?: string[]
  exclude?: string[]
}

function templatePatterns(viewRoot: string, include: string[]): string[] {
  const base = viewRoot === "." ? `**/${TEMPLATE_GLOB_PATTERN}` : `${viewRoot}/**/${TEMPLATE_GLOB_PATTERN}`

  return [base, ...include]
}

function templatesIn(projectPath: string, viewRoot: string, include: string[]): Promise<string[]> {
  return glob(templatePatterns(viewRoot, include), { cwd: projectPath, onlyFiles: true, dot: false, absolute: false })
}

function renderNodesIn(node: Node): ERBRenderNode[] {
  const found: ERBRenderNode[] = []

  const walk = (current: Node) => {
    if (current.type === "AST_ERB_RENDER_NODE") found.push(current as ERBRenderNode)

    for (const child of current.childNodes()) {
      if (child) walk(child)
    }
  }

  walk(node)

  return found
}

function localsPassedBy(node: ERBRenderNode): string[] {
  const locals: string[] = []

  for (const local of node.keywords?.locals ?? []) {
    if (!isRubyRenderLocalNode(local)) continue

    const name = local.name?.value

    if (name) locals.push(name)
  }

  return locals
}

function partialNameRenderedBy(node: ERBRenderNode): string | null {
  const call = node.prismNode
  if (!call) return null

  if (!isOutputRender(node)) return null

  const expression = renderPartialExpression(call)
  if (!expression) return null

  if (!isPrismNodeType(expression.node, "StringNode")) return null

  return expression.node.unescaped?.value ?? null
}

export function collectCallSites(herb: HerbBackend, partials: PartialIndex, file: string, source: string, callSites: Map<string, PartialCallSite[]>): number {
  if (!source.includes(RENDER_MARKER)) return 0

  let unresolved = 0

  for (const node of renderNodesIn(herb.parse(source, PARSER_OPTIONS).value)) {
    const name = partialNameRenderedBy(node)

    if (name === null) {
      unresolved++

      continue
    }

    const declaration = partials.lookup(name, file)

    if (!declaration) {
      unresolved++

      continue
    }

    const existing = callSites.get(declaration.file) ?? []

    existing.push({ caller: file, locals: localsPassedBy(node) })
    callSites.set(declaration.file, existing)
  }

  return unresolved
}

export async function buildPartialCallerIndex(herb: HerbBackend, projectPath: string, partials: PartialIndex, options: PartialCallerIndexOptions = {}): Promise<PartialCallerIndex> {
  const files = await templatesIn(projectPath, partials.viewRoot, options.include ?? [])
  const excluded = options.exclude?.length ? picomatch(options.exclude) : null
  const callSites = new Map<string, PartialCallSite[]>()

  let unresolvedRenders = 0
  let skippedFiles = 0

  for (const file of files.sort()) {
    if (excluded?.(file)) {
      skippedFiles++
      continue
    }

    let source: string

    try {
      source = readFileSync(join(projectPath, file), "utf-8")
    } catch {
      continue
    }

    try {
      unresolvedRenders += collectCallSites(herb, partials, file, source, callSites)
    } catch {
      continue
    }
  }

  return new PartialCallerIndex(callSites, unresolvedRenders, skippedFiles)
}

export function partialCallerIndexFrom(data: SerializedPartialCallerIndex | undefined): PartialCallerIndex | undefined {
  return data ? PartialCallerIndex.from(data) : undefined
}
