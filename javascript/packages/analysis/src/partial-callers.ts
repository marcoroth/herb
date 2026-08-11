import type { StrictLocal } from "./partial-index"

export type CallSiteKind = "render" | "layout" | "declaration"

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

export type StaticAttributeMap = Record<string, string>

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

export interface SerializedPartialCallerIndex {
  callSites: Record<string, PartialCallSite[]>
  documentRoots: string[]
  unresolvedRenders: Record<string, number>
  skippedFiles: string[]
}

export const MAX_ANCESTOR_CHAINS = 32

export const EMPTY_CHAIN: AncestorChain = Object.freeze({ tags: [], frames: [], occurrences: 1 })

const UNRESOLVED: PartialContext = Object.freeze({ chains: [], resolved: false })
const DOCUMENT_ROOT: PartialContext = Object.freeze({ chains: [EMPTY_CHAIN], resolved: true })

export class PartialCallerIndex {
  private readonly callSites: Map<string, PartialCallSite[]>
  private readonly documentRoots: Set<string>
  private readonly unresolvedRenders: Map<string, number>
  private readonly skippedFiles: Set<string>
  private readonly contexts: Map<string, PartialContext>

  static from(data: SerializedPartialCallerIndex): PartialCallerIndex {
    return new PartialCallerIndex(
      new Map(Object.entries(data.callSites)),
      new Set(data.documentRoots ?? []),
      new Map(Object.entries(data.unresolvedRenders ?? {})),
      new Set(data.skippedFiles ?? [])
    )
  }

  constructor(callSites: Map<string, PartialCallSite[]>, documentRoots: Set<string>, unresolvedRenders: Map<string, number>, skippedFiles: Set<string>) {
    this.callSites = callSites
    this.documentRoots = documentRoots
    this.contexts = new Map()
    this.unresolvedRenders = unresolvedRenders
    this.skippedFiles = skippedFiles
  }

  get unresolvedRenderCount(): number {
    let total = 0

    for (const count of this.unresolvedRenders.values()) total += count

    return total
  }

  get skippedFileCount(): number {
    return this.skippedFiles.size
  }

  get isComplete(): boolean {
    return this.unresolvedRenders.size === 0 && this.skippedFiles.size === 0
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

  toJSON(): SerializedPartialCallerIndex {
    return {
      callSites: Object.fromEntries(this.callSites),
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

export type AncestorVerdict = "always" | "never" | "mixed" | "unknown"

export function ancestorVerdict(context: PartialContext, localAncestors: string[], ...tagNames: string[]): AncestorVerdict {
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
