import { HerbRuntime } from "./runtime"

import { stateFor } from "./scoped-state"

import type { ScopedState } from "./scoped-state"
import type { StateScope } from "./state"
import type { SlotMutations } from "./mutations"
import type { SlotIndex } from "./slot-index"

export interface StateHost {
  element: Element
  state?: ScopedState
  mutations?: SlotMutations
  slots?: SlotIndex
  disconnect?(): void
}

export function useState(host: StateHost): ScopedState {
  const state = stateFor(host.element)
  const unsubscribes: (() => void)[] = []

  host.state = state
  host.mutations = HerbRuntime.get()?.mutations
  host.slots = HerbRuntime.get()?.slots

  const scope = state.scope

  let names: string[] = []

  if (scope) {
    names = namesFor(scope)
  }

  for (const name of names) {
    const method = (host as unknown as Record<string, unknown>)[`${name}Changed`]

    if (typeof method !== "function") {
      continue
    }

    unsubscribes.push(
      state.on(name, (value, previous) => (method as (value: unknown, previous: unknown) => void).call(host, value, previous)),
    )
  }

  const teardown = host.disconnect?.bind(host)

  host.disconnect = () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }

    teardown?.()
  }

  return state
}

function namesFor(scope: StateScope): string[] {
  const runtime = HerbRuntime.get()

  if (!runtime) {
    return []
  }

  return runtime.state.declaredStates(scope).map((declaration) => declaration.name)
}
