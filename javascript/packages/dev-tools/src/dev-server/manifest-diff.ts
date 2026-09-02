import type { StateManifest } from "@herb-tools/client"

export interface ManifestDelta {
  identical: boolean
  stateDerivable: boolean
  changedReads: string[]
  changedConditionals: string[]
  changedComputed: string[]
  changedPresence: string[]
}

function keysWhereDifferent(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])

  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

function serverReads(manifest: StateManifest): number {
  return Object.values(manifest.server ?? {}).reduce((count, reads) => count + reads.length, 0)
}

export function diffStateManifests(before: StateManifest | null, after: StateManifest | null): ManifestDelta {
  const empty = {
    changedReads: [] as string[],
    changedConditionals: [] as string[],
    changedComputed: [] as string[],
    changedPresence: [] as string[],
  }

  if (!before || !after) {
    return { identical: before === after, stateDerivable: false, ...empty }
  }

  const identical = JSON.stringify(before) === JSON.stringify(after)

  if (identical) {
    return { identical: true, stateDerivable: true, ...empty }
  }

  const declarationsAgree = JSON.stringify(before.declarations) === JSON.stringify(after.declarations)
  const stateDerivable = declarationsAgree && serverReads(before) === 0 && serverReads(after) === 0

  return {
    identical: false,
    stateDerivable,
    changedReads: keysWhereDifferent(before.reads ?? {}, after.reads ?? {}),
    changedConditionals: keysWhereDifferent(before.conditionals ?? {}, after.conditionals ?? {}),
    changedComputed: keysWhereDifferent(before.computed ?? {}, after.computed ?? {}),
    changedPresence: keysWhereDifferent(before.presence ?? {}, after.presence ?? {}),
  }
}
