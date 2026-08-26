import { Runtime } from "../runtime"

import type { StateValue } from "./values"
import type { ScopedSetOptions, StateScope } from "./types"

export interface ScopedState {
  scope: StateScope | null
  get(name: string): StateValue
  set(values: Record<string, StateValue>): boolean
  toggle(name: string): boolean
  increment(name: string, by?: number): boolean
  decrement(name: string, by?: number): boolean
  reset(name: string): boolean
  on(name: string, listener: (value: StateValue, previous: StateValue) => void): () => void
}

export function stateFor(element: Element): ScopedState {
  const runtime = Runtime.get()
  const state = runtime?.state

  const resolve = (name: string): ScopedSetOptions => {
    const scope = runtime?.state.scopeFor(element, name)

    if (!scope) {
      return {}
    }

    return { scope }
  }

  return {
    get scope() {
      return state?.scopeFor(element) ?? null
    },

    get: (name) => {
      return state?.getState(name, resolve(name)) ?? null
    },

    set: (values) => {
      const first = Object.keys(values)[0]

      return first ? (state?.setState(values, resolve(first)) ?? false) : false
    },

    toggle: (name) => {
      return state?.toggle(name, resolve(name)) ?? false
    },

    increment: (name, by) => {
      return state?.increment(name, { ...resolve(name), by }) ?? false
    },

    decrement: (name, by) => {
      return state?.decrement(name, { ...resolve(name), by }) ?? false
    },

    reset: (name) => {
      return state?.reset(name, resolve(name)) ?? false
    },

    on: (name, listener) => {
      return state?.on(name, listener, resolve(name)) ?? (() => {})
    }
  }
}
