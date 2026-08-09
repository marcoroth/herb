import picomatch from "picomatch"

import { glob } from "tinyglobby"
import { join } from "node:path"
import { readFileSync } from "node:fs"

import { getTagLocalName, isHTMLElementNode, isPrismNodeType, isRubyRenderLocalNode, layoutCandidatesFor, outranksTemplate, templateNameForFile } from "@herb-tools/core"
import { isOutputRender, renderPartialExpression } from "./rules/prism-rule-utils.js"
import { staticAncestorAttributes } from "./ancestor-attributes.js"

import { PartialCallerIndex } from "@herb-tools/core"

import { TEMPLATE_GLOB_PATTERN } from "@herb-tools/core"

import type { CallSiteLocation, ERBRenderNode, ERBYieldNode, HerbBackend, Node, PartialCallSite, PartialIndex, SerializedPartialCallerIndex, StaticAttributeMap } from "@herb-tools/core"

const RENDER_MARKER = "render"
const YIELD_MARKER = "yield"
const YIELD_KEYWORD = "yield"
const PARSER_OPTIONS = { render_nodes: true, prism_nodes: true, action_view_helpers: true } as const

export interface PartialCallerIndexOptions {
  include?: string[]
  exclude?: string[]
  resolveLayouts?: boolean
}

function templatePatterns(viewRoot: string, include: string[]): string[] {
  const base = viewRoot === "." ? `**/${TEMPLATE_GLOB_PATTERN}` : `${viewRoot}/**/${TEMPLATE_GLOB_PATTERN}`

  return [base, ...include]
}

function templatesIn(projectPath: string, viewRoot: string, include: string[]): Promise<string[]> {
  return glob(templatePatterns(viewRoot, include), { cwd: projectPath, onlyFiles: true, dot: false, absolute: false })
}

interface RenderSite {
  node: ERBRenderNode
  ancestors: string[]
  ancestorAttributes?: StaticAttributeMap[]
}

export interface YieldSite {
  ancestors: string[]
  ancestorAttributes?: StaticAttributeMap[]
  location?: CallSiteLocation
}

interface ScannedTemplate {
  sites: RenderSite[]
  yields: YieldSite[]
  isDocumentRoot: boolean
}

function isBareYield(node: Node): boolean {
  if (node.type !== "AST_ERB_YIELD_NODE") return false

  return (node as ERBYieldNode).content?.value.trim() === YIELD_KEYWORD
}

function callSiteLocation(node: Node): CallSiteLocation | undefined {
  const start = node.location?.start

  if (!start) return undefined

  return { line: start.line, column: start.column }
}

function scanTemplate(node: Node): ScannedTemplate {
  const sites: RenderSite[] = []
  const yields: YieldSite[] = []
  const stack: { tagName: string, attributes: StaticAttributeMap }[] = []

  let isDocumentRoot = false

  const walk = (current: Node) => {
    const element = isHTMLElementNode(current) ? current : null
    const tagName = element ? getTagLocalName(element) : null

    if (tagName === "html") isDocumentRoot = true
    if (tagName) {
      stack.push({ tagName, attributes: staticAncestorAttributes(element!) })
    }

    const ancestors = stack.map(ancestor => ancestor.tagName)
    const attributes = stack.map(ancestor => ancestor.attributes)
    const ancestorAttributes = attributes.some(attribute => Object.keys(attribute).length > 0) ? attributes : undefined

    if (current.type === "AST_ERB_RENDER_NODE") sites.push({ node: current as ERBRenderNode, ancestors, ancestorAttributes })
    if (isBareYield(current)) yields.push({ ancestors, ancestorAttributes, location: callSiteLocation(current) })

    for (const child of current.childNodes()) {
      if (child) walk(child)
    }

    if (tagName) stack.pop()
  }

  walk(node)

  return { sites, yields, isDocumentRoot }
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

export interface CollectedCallSites {
  unresolved: number
  isDocumentRoot: boolean
  yields: YieldSite[]
}

const NOTHING_COLLECTED: CollectedCallSites = { unresolved: 0, isDocumentRoot: false, yields: [] }

export function collectCallSites(herb: HerbBackend, partials: PartialIndex, file: string, source: string, callSites: Map<string, PartialCallSite[]>): CollectedCallSites {
  if (!source.includes(RENDER_MARKER) && !source.includes(YIELD_MARKER)) return NOTHING_COLLECTED

  let unresolved = 0

  const { sites, yields, isDocumentRoot } = scanTemplate(herb.parse(source, PARSER_OPTIONS).value)

  for (const { node, ancestors, ancestorAttributes } of sites) {
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

    existing.push({ caller: file, locals: localsPassedBy(node), ancestors, ancestorAttributes, via: "render", location: callSiteLocation(node) })
    callSites.set(declaration.file, existing)
  }

  return { unresolved, isDocumentRoot, yields }
}

function addLayoutCallSites(files: string[], layoutYields: Map<string, YieldSite[]>, viewRoot: string, callSites: Map<string, PartialCallSite[]>): void {
  const layouts = new Map<string, string>()

  for (const file of files) {
    const name = templateNameForFile(file, viewRoot)

    if (name === null || !layoutYields.has(file)) continue

    const existing = layouts.get(name)

    if (existing && !outranksTemplate(file, existing)) continue

    layouts.set(name, file)
  }

  for (const file of files) {
    for (const candidate of layoutCandidatesFor(file, viewRoot)) {
      const layout = layouts.get(candidate)

      if (!layout || layout === file) continue

      const existing = callSites.get(file) ?? []

      for (const { ancestors, ancestorAttributes, location } of layoutYields.get(layout) ?? []) {
        existing.push({ caller: layout, locals: [], ancestors, ancestorAttributes, via: "layout", location })
      }

      callSites.set(file, existing)

      break
    }
  }
}

export async function buildPartialCallerIndex(herb: HerbBackend, projectPath: string, partials: PartialIndex, options: PartialCallerIndexOptions = {}): Promise<PartialCallerIndex> {
  const files = await templatesIn(projectPath, partials.viewRoot, options.include ?? [])
  const excluded = options.exclude?.length ? picomatch(options.exclude) : null
  const callSites = new Map<string, PartialCallSite[]>()
  const documentRoots = new Set<string>()
  const layoutYields = new Map<string, YieldSite[]>()
  const scanned: string[] = []

  const unresolvedRenders = new Map<string, number>()
  const skippedFiles = new Set<string>()

  for (const file of files.sort()) {
    if (excluded?.(file)) {
      skippedFiles.add(file)
      continue
    }

    let source: string

    try {
      source = readFileSync(join(projectPath, file), "utf-8")
    } catch {
      continue
    }

    try {
      const collected = collectCallSites(herb, partials, file, source, callSites)

      if (collected.unresolved > 0) unresolvedRenders.set(file, collected.unresolved)
      scanned.push(file)

      if (collected.isDocumentRoot) documentRoots.add(file)
      if (collected.yields.length > 0) layoutYields.set(file, collected.yields)
    } catch {
      continue
    }
  }

  if (options.resolveLayouts !== false) {
    addLayoutCallSites(scanned, layoutYields, partials.viewRoot, callSites)
  }

  return new PartialCallerIndex(callSites, documentRoots, unresolvedRenders, skippedFiles)
}

export function partialCallerIndexFrom(data: SerializedPartialCallerIndex | undefined): PartialCallerIndex | undefined {
  return data ? PartialCallerIndex.from(data) : undefined
}
