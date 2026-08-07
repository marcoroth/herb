import type { StrictLocal } from "./action-view-partial-index.js"

export interface PartialCallSite {
  caller: string
  locals: string[]
}

export interface InferredSignature {
  locals: StrictLocal[]
  callSiteCount: number
  keywordRest: boolean
}

export interface SerializedPartialCallerIndex {
  callSites: Record<string, PartialCallSite[]>
  unresolvedRenders: number
  skippedFiles: number
}

export class PartialCallerIndex {
  readonly unresolvedRenders: number
  readonly skippedFiles: number

  private readonly callSites: Map<string, PartialCallSite[]>

  static from(data: SerializedPartialCallerIndex): PartialCallerIndex {
    return new PartialCallerIndex(new Map(Object.entries(data.callSites)), data.unresolvedRenders, data.skippedFiles)
  }

  constructor(callSites: Map<string, PartialCallSite[]>, unresolvedRenders: number, skippedFiles: number) {
    this.callSites = callSites
    this.unresolvedRenders = unresolvedRenders
    this.skippedFiles = skippedFiles
  }

  get isComplete(): boolean {
    return this.unresolvedRenders === 0 && this.skippedFiles === 0
  }

  callersOf(partialFile: string): PartialCallSite[] {
    return this.callSites.get(partialFile) ?? []
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

  get size(): number {
    return this.callSites.size
  }

  toJSON(): SerializedPartialCallerIndex {
    return {
      callSites: Object.fromEntries(this.callSites),
      unresolvedRenders: this.unresolvedRenders,
      skippedFiles: this.skippedFiles
    }
  }
}

export function strictLocalsDeclaration(signature: InferredSignature): string {
  const parameters = signature.locals.map(local => (local.required ? `${local.name}:` : `${local.name}: nil`))

  if (signature.keywordRest) parameters.push("**")

  return `<%# locals: (${parameters.join(", ")}) %>`
}
