import { HerbRuntime, stateFor } from "./runtime"

import type { ScopedState } from "./runtime"
import type { StateScope } from "./state"

export interface StateHost {
  element: Element
  state?: ScopedState
  disconnect?(): void
}

export function useState(host: StateHost): ScopedState {
  const state = stateFor(host.element)
  const unsubscribes: (() => void)[] = []

  host.state = state

  const scope = state.scope

  for (const name of scope ? namesFor(scope) : []) {
    const method = (host as unknown as Record<string, unknown>)[`${name}Changed`]

    if (typeof method !== "function") continue

    unsubscribes.push(
      state.on(name, (value, previous) => (method as (value: unknown, previous: unknown) => void).call(host, value, previous)),
    )
  }

  const teardown = host.disconnect?.bind(host)

  host.disconnect = () => {
    for (const unsubscribe of unsubscribes) unsubscribe()

    teardown?.()
  }

  return state
}

function namesFor(scope: StateScope): string[] {
  const runtime = HerbRuntime.get()

  if (!runtime) return []

  return runtime.state.declaredStates(scope).map((declaration) => declaration.name)
}
