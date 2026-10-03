import type { Item, Region } from "../types"
import type { ScopeStore, StateBucket, StateScope } from "./types"

export const ITEM_SCOPES = new WeakMap<Item, StateScope>()
export const REGION_SCOPES = new WeakMap<Region, StateScope>()

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

export function collectionIn(scope: StateScope): number | null {
  return scope.item?.collection.index ?? null
}
