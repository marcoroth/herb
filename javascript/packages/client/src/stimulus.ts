import { Runtime } from "./runtime"

import { stateFor } from "./state/for-element"

import type { Slots } from "./slots/slots"
import type { Outbox } from "./outbox/outbox"
import type { StateScope } from "./state/types"
import type { ScopedState } from "./state/for-element"

export interface StateHost {
  element: Element
  state?: ScopedState
  outbox?: Outbox
  slots?: Slots
  disconnect?(): void
}

export function useState(host: StateHost): ScopedState {
  const state = stateFor(host.element)
  const scope = state.scope
  const unsubscribes: (() => void)[] = []

  host.state = state
  host.outbox = Runtime.get()?.outbox
  host.slots = Runtime.get()?.slots

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
  const runtime = Runtime.get()

  if (!runtime) {
    return []
  }

  return runtime.state.declaredStates(scope).map((declaration) => declaration.name)
}
