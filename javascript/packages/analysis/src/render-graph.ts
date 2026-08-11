import { EMPTY_CHAIN, NO_ROOTS, MAX_ANCESTOR_CHAINS } from "./render-graph-utils.js"

import type { PartialContext, PartialCallSite, TemplateRoots, SerializedRenderGraph, InferredSignature, AncestorChain, CallFrame } from "./render-graph-utils.js"

const UNRESOLVED: PartialContext = Object.freeze({ chains: [], resolved: false })
const DOCUMENT_ROOT: PartialContext = Object.freeze({ chains: [EMPTY_CHAIN], resolved: true })

export class RenderGraph {
  private readonly callSites: Map<string, PartialCallSite[]>
  private readonly roots: Map<string, TemplateRoots>
  private readonly documentRoots: Set<string>
  private readonly unresolvedRenders: Map<string, number>
  private readonly skippedFiles: Set<string>
  private readonly contexts: Map<string, PartialContext>

  static from(data: SerializedRenderGraph): RenderGraph {
    return new RenderGraph(
      new Map(Object.entries(data.callSites)),
      new Map(Object.entries(data.roots ?? {})),
      new Set(data.documentRoots ?? []),
      new Map(Object.entries(data.unresolvedRenders ?? {})),
      new Set(data.skippedFiles ?? [])
    )
  }

  constructor(callSites: Map<string, PartialCallSite[]>, roots: Map<string, TemplateRoots>, documentRoots: Set<string>, unresolvedRenders: Map<string, number>, skippedFiles: Set<string>) {
    this.callSites = callSites
    this.roots = roots
    this.documentRoots = documentRoots
    this.contexts = new Map()
    this.unresolvedRenders = unresolvedRenders
    this.skippedFiles = skippedFiles
  }

  get unresolvedRenderCount(): number {
    let total = 0

    for (const count of this.unresolvedRenders.values()) {
      total += count
    }

    return total
  }

  get skippedFileCount(): number {
    return this.skippedFiles.size
  }

  get isComplete(): boolean {
    return this.unresolvedRenders.size === 0 && this.skippedFiles.size === 0
  }

  rootsOf(file: string): TemplateRoots {
    return this.roots.get(file) ?? NO_ROOTS
  }

  setRoots(file: string, roots: TemplateRoots): void {
    this.roots.set(file, roots)
  }

  callersOf(partialFile: string): PartialCallSite[] {
    return this.callSites.get(partialFile) ?? []
  }

  replaceCallsFrom(caller: string, sites: Map<string, PartialCallSite[]>, unresolved = 0): boolean {
    let changed = this.replaceUnresolvedFrom(caller, unresolved)

    for (const [partialFile, callSites] of this.callSites) {
      const remaining = callSites.filter(callSite => callSite.caller !== caller)

      if (remaining.length === callSites.length) continue

      changed = true

      if (remaining.length > 0) {
        this.callSites.set(partialFile, remaining)
      } else {
        this.callSites.delete(partialFile)
      }
    }

    for (const [partialFile, callSites] of sites) {
      if (callSites.length === 0) continue

      changed = true

      this.callSites.set(partialFile, [...this.callersOf(partialFile), ...callSites])
    }

    if (changed) this.contexts.clear()

    return changed
  }

  private replaceUnresolvedFrom(caller: string, unresolved: number): boolean {
    const previous = this.unresolvedRenders.get(caller) ?? 0

    if (previous === unresolved) return false

    if (unresolved === 0) {
      this.unresolvedRenders.delete(caller)
    } else {
      this.unresolvedRenders.set(caller, unresolved)
    }

    return true
  }

  removeCallsTo(partialFile: string): boolean {
    if (!this.callSites.delete(partialFile)) return false

    this.contexts.clear()

    return true
  }

  inferSignature(partialFile: string): InferredSignature {
    const callers = this.callersOf(partialFile)
    const names: string[] = []

    for (const callSite of callers) {
      for (const local of callSite.locals) {
        if (!names.includes(local)) names.push(local)
      }
    }

    names.sort()

    return {
      locals: names.map(name => ({ name, required: false })),
      callSiteCount: callers.length,
      keywordRest: !this.isComplete
    }
  }

  contextOf(file: string): PartialContext {
    const cached = this.contexts.get(file)
    if (cached) return cached

    const context = this.resolveContext(file, new Set())

    this.contexts.set(file, context)

    return context
  }

  private resolveContext(file: string, visiting: Set<string>): PartialContext {
    if (this.documentRoots.has(file)) return DOCUMENT_ROOT
    if (visiting.has(file)) return UNRESOLVED

    const callSites = this.callersOf(file)
    if (callSites.length === 0) return UNRESOLVED

    visiting.add(file)

    const chains: AncestorChain[] = []
    const byKey = new Map<string, AncestorChain>()

    let resolved = true

    for (const callSite of callSites) {
      const parent = this.resolveContext(callSite.caller, visiting)
      if (!parent.resolved) resolved = false

      const frame = this.frameFor(callSite)
      const prefixes = parent.chains.length > 0 ? parent.chains : [EMPTY_CHAIN]

      for (const prefix of prefixes) {
        const tags = [...prefix.tags, ...callSite.ancestors]
        const attributes = [
          ...(prefix.attributes ?? prefix.tags.map(() => ({}))),
          ...(callSite.ancestorAttributes ?? callSite.ancestors.map(() => ({}))),
        ]

        const key = JSON.stringify([tags, attributes])
        const existing = byKey.get(key)

        if (existing) {
          existing.occurrences += prefix.occurrences

          continue
        }

        if (chains.length >= MAX_ANCESTOR_CHAINS) {
          resolved = false

          break
        }

        const chain: AncestorChain = {
          tags,
          ...(attributes.some(attribute => Object.keys(attribute).length > 0) ? { attributes } : {}),
          frames: [...prefix.frames, frame],
          occurrences: prefix.occurrences,
        }

        byKey.set(key, chain)
        chains.push(chain)
      }
    }

    visiting.delete(file)

    return { chains, resolved }
  }

  get size(): number {
    return this.callSites.size
  }

  toJSON(): SerializedRenderGraph {
    return {
      callSites: Object.fromEntries(this.callSites),
      roots: Object.fromEntries(this.roots),
      documentRoots: [...this.documentRoots].sort(),
      unresolvedRenders: Object.fromEntries(this.unresolvedRenders),
      skippedFiles: [...this.skippedFiles].sort()
    }
  }

  private frameFor(callSite: PartialCallSite): CallFrame {
    return {
      file: callSite.caller,
      ancestors: callSite.ancestors,
      ...(callSite.ancestorAttributes ? { ancestorAttributes: callSite.ancestorAttributes } : {}),
      via: callSite.via ?? "render",
      location: callSite.location ?? null,
    }
  }
}
