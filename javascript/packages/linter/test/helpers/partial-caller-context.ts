import { PartialCallerIndex } from "@herb-tools/core"

import type { PartialCallSite } from "@herb-tools/core"

export const LAYOUT = "app/views/layouts/application.html.erb"

export function callerIndexFor(callSites: Record<string, string[][]>, documentRoots: string[] = [LAYOUT]): PartialCallerIndex {
  const entries: [string, PartialCallSite[]][] = Object.entries(callSites).map(([file, chains]) => [
    file,
    chains.map(ancestors => ({ caller: LAYOUT, locals: [], ancestors })),
  ])

  return new PartialCallerIndex(new Map(entries), new Set(documentRoots), 0, 0)
}

export function renderedFrom(fileName: string, ...chains: string[][]) {
  return { fileName, partialCallers: callerIndexFor({ [fileName]: chains }) }
}

export function renderedFromNowhere(fileName: string) {
  return { fileName, partialCallers: callerIndexFor({}) }
}
