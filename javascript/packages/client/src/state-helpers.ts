import { literal } from "./conditions"

import { REGION_SCOPES, ITEM_SCOPES } from "./state.js"

import type { DiagnosticSpot } from "./report"
import type { Item, Region } from "./types"
import type { StateValue } from "./values"
import type { StateComparand } from "./conditions"

import type { StateBucket, ScopeStore, DeclaredState, StateManifest, StateScope } from "./state.js"

export function scopeOf(region: Region, item: Item | null = null): StateScope {
  if (!item) {
    let scope = REGION_SCOPES.get(region)

    if (!scope) {
      scope = { region, item: null }
      REGION_SCOPES.set(region, scope)
    }

    return scope
  }

  let scope = ITEM_SCOPES.get(item)

  if (!scope) {
    scope = { region, item }
    ITEM_SCOPES.set(item, scope)
  }

  return scope
}

export function scoped(store: ScopeStore, scope: StateScope): StateBucket {
  let regionStore = store.get(scope.region)

  if (!regionStore) {
    regionStore = new Map()
    store.set(scope.region, regionStore)
  }

  const key = scope.item?.key ?? ""
  let bucket = regionStore.get(key)

  if (!bucket) {
    bucket = new Map()
    regionStore.set(key, bucket)
  }

  return bucket
}

export function declared(manifest: StateManifest, name: string, collection: number | null): DeclaredState | null {
  const exact = manifest.declarations.find((declaration) => {
    if (declaration.name !== name) {
      return false
    }

    if (collection === null) {
      return declaration.scope === "region"
    }

    return declaration.scope === collection
  })

  if (exact) {
    return exact
  }

  if (collection === null) {
    return null
  }

  return manifest.declarations.find((declaration) => declaration.name === name && declaration.scope === "region") ?? null
}

export function collectionIn(scope: StateScope): number | null {
  return scope.item?.collection.index ?? null
}

export function declarationSpot(declaration: DeclaredState): DiagnosticSpot {
  if (declaration.line === undefined || declaration.line === null) {
    return {}
  }

  return { location: { start: { line: declaration.line, column: declaration.column ?? 0 } } }
}

export function declaredValue(declaration: DeclaredState): StateValue | undefined {
  if (declaration.value !== undefined) {
    return declaration.value
  }

  return literal(declaration.default)
}

export function comparandLiteral(comparand: StateComparand): StateValue | undefined {
  if (comparand === null || typeof comparand !== "object") {
    return typeof comparand === "string" ? literal(comparand) : undefined
  }

  if ("state" in comparand) {
    return undefined
  }

  return comparand.value
}
