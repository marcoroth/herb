import type { RenderGraph } from "./render-graph"
import type { StrictLocal } from "./partial-index"

export type CallSiteKind = "render" | "layout" | "declaration"
export type Verdict = "always" | "never" | "mixed" | "unknown"
export type StaticAttributeMap = Record<string, string>

export const MAX_ANCESTOR_CHAINS = 32
export const NO_ROOTS: TemplateRoots = Object.freeze({ tags: [], conditionalTags: [], renders: [], resolved: true })
export const EMPTY_CHAIN: AncestorChain = Object.freeze({ tags: [], frames: [], occurrences: 1 })

export interface CallSiteLocation {
  line: number
  column: number
}

export interface PartialCallSite {
  caller: string
  locals: string[]
  ancestors: string[]
  ancestorAttributes?: StaticAttributeMap[]
  via?: CallSiteKind
  location?: CallSiteLocation
}

export interface InferredSignature {
  locals: StrictLocal[]
  callSiteCount: number
  keywordRest: boolean
}

export interface CallFrame {
  file: string
  ancestors: string[]
  ancestorAttributes?: StaticAttributeMap[]
  via: CallSiteKind
  location: CallSiteLocation | null
}

export interface AncestorChain {
  tags: string[]
  attributes?: StaticAttributeMap[]
  frames: CallFrame[]
  occurrences: number
}

export interface PartialContext {
  chains: AncestorChain[]
  resolved: boolean
}

export interface SerializedRenderGraph {
  callSites: Record<string, PartialCallSite[]>
  roots: Record<string, TemplateRoots>
  documentRoots: string[]
  unresolvedRenders: Record<string, number>
  skippedFiles: string[]
}

export interface TemplateRoots {
  tags: string[]
  conditionalTags: string[]
  renders: string[]
  resolved: boolean
}

export function ancestorVerdict(context: PartialContext, localAncestors: string[], ...tagNames: string[]): Verdict {
  const inside = (chain: string[]) => chain.some(tag => tagNames.includes(tag))

  if (inside(localAncestors)) return "always"
  if (context.chains.length === 0) return "unknown"

  const matches = context.chains.filter(chain => inside(chain.tags)).length
  if (matches === context.chains.length) return "always"
  if (matches > 0) return "mixed"

  return context.resolved ? "never" : "unknown"
}

export function closestAncestor(context: PartialContext, localAncestors: string[], ...tagNames: string[]): string | null {
  const innermost = (chain: string[]) => {
    for (let index = chain.length - 1; index >= 0; index--) {
      if (tagNames.includes(chain[index])) return chain[index]
    }

    return null
  }

  const local = innermost(localAncestors)
  if (local) return local

  for (const chain of context.chains) {
    const match = innermost(chain.tags)

    if (match) {
      return match
    }
  }

  return null
}

export function strictLocalsDeclaration(signature: InferredSignature): string {
  const parameters = signature.locals.map(local => (local.required ? `${local.name}:` : `${local.name}: nil`))

  if (signature.keywordRest) {
    parameters.push("**")
  }

  return `<%# locals: (${parameters.join(", ")}) %>`
}

export function descendantVerdict(graph: RenderGraph, files: string[], ...tagNames: string[]): Verdict {
  if (files.length === 0) return "unknown"

  const verdicts = files.map(file => rootVerdict(graph, file, tagNames, new Set()))

  if (verdicts.every(verdict => verdict === "always")) return "always"
  if (verdicts.every(verdict => verdict === "never")) return "never"
  if (verdicts.some(verdict => verdict === "always" || verdict === "mixed")) return "mixed"

  return "unknown"
}

function rootVerdict(graph: RenderGraph, file: string, tagNames: string[], seen: Set<string>): Verdict {
  if (seen.has(file)) return "never"

  seen.add(file)

  const roots = graph.rootsOf(file)

  if (roots.tags.some(tag => tagNames.includes(tag))) return "always"
  if (roots.conditionalTags.some(tag => tagNames.includes(tag))) return "mixed"

  const through = roots.renders.map(rendered => rootVerdict(graph, rendered, tagNames, new Set(seen)))

  if (through.includes("always")) return "always"
  if (through.includes("mixed")) return "mixed"
  if (!roots.resolved || through.includes("unknown")) return "unknown"

  return "never"
}
