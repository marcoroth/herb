import { RenderGraph } from "@herb-tools/analysis"

import type { PartialCallSite } from "@herb-tools/analysis"

export const LAYOUT = "app/views/layouts/application.html.erb"

export function callerIndexFor(callSites: Record<string, string[][]>, documentRoots: string[] = [LAYOUT]): RenderGraph {
  const entries: [string, PartialCallSite[]][] = Object.entries(callSites).map(([file, chains]) => [
    file,
    chains.map(ancestors => ({ caller: LAYOUT, locals: [], ancestors })),
  ])

  return new RenderGraph(new Map(entries), new Map(), new Set(documentRoots), new Map(), new Set())
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

export function callerIndexWithLocals(partialFile: string, callers: CallerLocals[], unresolved = 0): RenderGraph {
  const sites: PartialCallSite[] = callers.map(({ caller, locals }) => ({ caller, locals, ancestors: [] }))

  const unresolvedRenders = new Map<string, number>()

  if (unresolved > 0 && callers.length > 0) unresolvedRenders.set(callers[0].caller, unresolved)

  return new RenderGraph(new Map([[partialFile, sites]]), new Map(), new Set(), unresolvedRenders, new Set())
}
