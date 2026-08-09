import { PartialCallerIndex } from "@herb-tools/core"

import type { PartialCallSite } from "@herb-tools/core"

export const LAYOUT = "app/views/layouts/application.html.erb"

export function callerIndexFor(callSites: Record<string, string[][]>, documentRoots: string[] = [LAYOUT]): PartialCallerIndex {
  const entries: [string, PartialCallSite[]][] = Object.entries(callSites).map(([file, chains]) => [
    file,
    chains.map(ancestors => ({ caller: LAYOUT, locals: [], ancestors })),
  ])

  return new PartialCallerIndex(new Map(entries), new Set(documentRoots), new Map(), new Set())
}

export function renderedFrom(fileName: string, ...chains: string[][]) {
  return { fileName, partialCallers: callerIndexFor({ [fileName]: chains }) }
}

export function renderedFromNowhere(fileName: string) {
  return { fileName, partialCallers: callerIndexFor({}) }
}

export interface CallerLocals {
  caller: string
  locals: string[]
}

export function callerIndexWithLocals(partialFile: string, callers: CallerLocals[], unresolved = 0): PartialCallerIndex {
  const sites: PartialCallSite[] = callers.map(({ caller, locals }) => ({ caller, locals, ancestors: [] }))

  const unresolvedRenders = new Map<string, number>()

  if (unresolved > 0 && callers.length > 0) unresolvedRenders.set(callers[0].caller, unresolved)

  return new PartialCallerIndex(new Map([[partialFile, sites]]), new Set(), unresolvedRenders, new Set())
}
