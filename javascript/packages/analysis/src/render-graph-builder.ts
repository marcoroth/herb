import picomatch from "picomatch"

import { glob } from "tinyglobby"
import { join } from "node:path"
import { readFileSync } from "node:fs"

import { getTagLocalName, isERBCaseNode, isERBIfNode, isERBOutputNode, isERBRenderNode, isERBUnlessNode, isHTMLElementNode, isPrismNodeType, isRubyRenderLocalNode } from "@herb-tools/core"
import { outranksTemplate } from "./partial-index"
import { layoutCandidatesForRoots, templateNameForRoots, isPartialPath } from "./partial-resolution"
import { renderPartialExpression } from "./render-expression"
import { staticAncestorAttributes } from "./ancestor-attributes"

import { RenderGraph } from "./render-graph"

import type { PartialIndex } from "./partial-index"
import type { ERBRenderNode, ERBYieldNode, HerbBackend, Node } from "@herb-tools/core"
import type { CallSiteLocation, PartialCallSite, SerializedRenderGraph, StaticAttributeMap, TemplateRoots } from "./render-graph-utils"

import { NO_ROOTS } from "./render-graph-utils"
import { TEMPLATE_GLOB_PATTERN } from "./partial-resolution"

const RENDER_MARKER = "render"
const YIELD_MARKER = "yield"
const YIELD_KEYWORD = "yield"
const PARSER_OPTIONS = { render_nodes: true, prism_nodes: true, action_view_helpers: true } as const
const NOTHING_COLLECTED: CollectedCallSites = { unresolved: 0, isDocumentRoot: false, yields: [], roots: NO_ROOTS }

export interface RenderGraphOptions {
  include?: string[]
  exclude?: string[]
  resolveLayouts?: boolean
}

export interface CollectedCallSites {
  unresolved: number
  isDocumentRoot: boolean
  yields: YieldSite[]
  roots: TemplateRoots
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
  roots: TemplateRoots
}

function templatePatterns(viewRoot: string, include: string[]): string[] {
  const base = viewRoot === "." ? `**/${TEMPLATE_GLOB_PATTERN}` : `${viewRoot}/**/${TEMPLATE_GLOB_PATTERN}`

  return [base, ...include]
}

function templatesIn(projectPath: string, viewRoot: string, include: string[]): Promise<string[]> {
  return glob(templatePatterns(viewRoot, include), { cwd: projectPath, onlyFiles: true, dot: false, absolute: false })
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
  const tags: string[] = []
  const conditionalTags: string[] = []
  const renders: string[] = []

  let isDocumentRoot = false
  let conditionalDepth = 0
  let rootsResolved = true

  const walk = (current: Node) => {
    const element = isHTMLElementNode(current) ? current : null
    const tagName = element ? getTagLocalName(element) : null
    const conditional = isERBIfNode(current) || isERBUnlessNode(current) || isERBCaseNode(current)

    if (conditional) conditionalDepth += 1

    if (stack.length === 0) {
      if (tagName) {
        (conditionalDepth > 0 ? conditionalTags : tags).push(tagName)
      } else if (isERBRenderNode(current)) {
        const rendered = partialNameRenderedBy(current as ERBRenderNode)

        if (rendered) {
          renders.push(rendered)
        } else {
          rootsResolved = false
        }
      }
    }

    if (tagName === "html") {
      isDocumentRoot = true
    }

    if (tagName) {
      stack.push({ tagName, attributes: staticAncestorAttributes(element!) })
    }

    const ancestors = stack.map(ancestor => ancestor.tagName)
    const attributes = stack.map(ancestor => ancestor.attributes)
    const ancestorAttributes = attributes.some(attribute => Object.keys(attribute).length > 0) ? attributes : undefined

    if (isERBRenderNode(current)) {
      sites.push({ node: current, ancestors, ancestorAttributes })
    }

    if (isBareYield(current)) {
      yields.push({ ancestors, ancestorAttributes, location: callSiteLocation(current) })
    }

    for (const child of current.childNodes()) {
      if (child) {
        walk(child)
      }
    }

    if (tagName) stack.pop()
    if (conditional) conditionalDepth -= 1
  }

  walk(node)

  return { sites, yields, isDocumentRoot, roots: { tags, conditionalTags, renders, resolved: rootsResolved } }
}

function localsPassedBy(node: ERBRenderNode): string[] {
  const locals: string[] = []

  for (const local of node.keywords?.locals ?? []) {
    if (!isRubyRenderLocalNode(local)) continue

    const name = local.name?.value

    if (name) {
      locals.push(name)
    }
  }

  return locals
}

function partialNameRenderedBy(node: ERBRenderNode): string | null {
  const call = node.prismNode
  if (!call) return null

  if (!isERBOutputNode(node)) return null

  const expression = renderPartialExpression(call)
  if (!expression) return null

  if (!isPrismNodeType(expression.node, "StringNode")) return null

  return expression.node.unescaped?.value ?? null
}

export function collectCallSites(herb: HerbBackend, partials: PartialIndex, file: string, source: string, callSites: Map<string, PartialCallSite[]>): CollectedCallSites {
  const rendersNothing = !source.includes(RENDER_MARKER) && !source.includes(YIELD_MARKER)

  if (rendersNothing && !isPartialPath(file)) return NOTHING_COLLECTED

  let unresolved = 0

  const { sites, yields, isDocumentRoot, roots } = scanTemplate(herb.parse(source, PARSER_OPTIONS).value)

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

  const rootRenders: string[] = []
  let rootsResolved = roots.resolved

  for (const name of roots.renders) {
    const target = partials.lookup(name, file)

    if (target) {
      rootRenders.push(target.file)
    } else {
      rootsResolved = false
    }
  }

  return { unresolved, isDocumentRoot, yields, roots: { ...roots, renders: rootRenders, resolved: rootsResolved } }
}

function addLayoutCallSites(files: string[], layoutYields: Map<string, YieldSite[]>, viewRoots: string[], callSites: Map<string, PartialCallSite[]>): void {
  const layouts = new Map<string, string>()

  for (const file of files) {
    const name = templateNameForRoots(file, viewRoots)

    if (name === null || !layoutYields.has(file)) {
      continue
    }

    const existing = layouts.get(name)

    if (existing && !outranksTemplate(file, existing)) {
      continue
    }

    layouts.set(name, file)
  }

  for (const file of files) {
    for (const candidate of layoutCandidatesForRoots(file, viewRoots)) {
      const layout = layouts.get(candidate)

      if (!layout || layout === file) {
        continue
      }

      const existing = callSites.get(file) ?? []

      for (const { ancestors, ancestorAttributes, location } of layoutYields.get(layout) ?? []) {
        existing.push({ caller: layout, locals: [], ancestors, ancestorAttributes, via: "layout", location })
      }

      callSites.set(file, existing)

      break
    }
  }
}

export async function buildRenderGraph(herb: HerbBackend, projectPath: string, partials: PartialIndex, options: RenderGraphOptions = {}): Promise<RenderGraph> {
  const files = await templatesIn(projectPath, partials.viewRoots[0] ?? ".", options.include ?? [])
  const excluded = options.exclude?.length ? picomatch(options.exclude) : null
  const callSites = new Map<string, PartialCallSite[]>()
  const documentRoots = new Set<string>()
  const roots = new Map<string, TemplateRoots>()
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

      if (collected.unresolved > 0) {
        unresolvedRenders.set(file, collected.unresolved)
      }

      scanned.push(file)

      if (collected.isDocumentRoot) {
        documentRoots.add(file)
      }

      roots.set(file, collected.roots)

      if (collected.yields.length > 0) {
        layoutYields.set(file, collected.yields)
      }
    } catch {
      continue
    }
  }

  if (options.resolveLayouts !== false) {
    addLayoutCallSites(scanned, layoutYields, partials.viewRoots, callSites)
  }

  return new RenderGraph(callSites, roots, documentRoots, unresolvedRenders, skippedFiles)
}

export function renderGraphFrom(data: SerializedRenderGraph | undefined): RenderGraph | undefined {
  return data ? RenderGraph.from(data) : undefined
}
