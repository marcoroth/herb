import { clearOnNavigation } from "./report"
import { SlotActions } from "./actions"
import { SlotIndex } from "./slot-index"
import { SlotMutations } from "./mutations"
import { SlotState } from "./state"

import type { MutationsOptions } from "./mutations"
import type { ScopedSetOptions, StateOptions, StateScope, StateValue } from "./state"

const CONSTRUCT = Symbol("HerbRuntime.start")

let instance: HerbRuntime | null = null

export interface RuntimeOptions {
  state?: StateOptions
  mutations?: MutationsOptions
}

export class HerbRuntime {
  public readonly slots: SlotIndex
  public readonly state: SlotState
  public readonly mutations: SlotMutations
  public readonly actions: SlotActions

  private stopClearing: (() => void) | null = null

  private constructor(token?: symbol, options: RuntimeOptions = {}) {
    if (token !== CONSTRUCT) {
      throw new TypeError("HerbRuntime is created by HerbRuntime.start()")
    }

    this.slots = new SlotIndex()
    this.state = new SlotState(this.slots, options.state)
    this.mutations = new SlotMutations(this.slots, this.state, options.mutations)
    this.actions = new SlotActions(this.state)
  }

  static start(options: RuntimeOptions = {}): HerbRuntime {
    const existing = HerbRuntime.get()
    if (existing) return existing

    const runtime = new HerbRuntime(CONSTRUCT, options)

    runtime.slots.observe()
    runtime.state.adopt()
    runtime.state.observe()
    runtime.actions.start()
    runtime.stopClearing = clearOnNavigation()

    instance = runtime

    return runtime
  }

  static get(): HerbRuntime | null {
    return instance
  }

  stop(): void {
    this.slots.disconnect()
    this.state.disconnect()
    this.mutations.abort()
    this.actions.stop()
    this.stopClearing?.()
    this.stopClearing = null

    if (instance === this) {
      instance = null
    }
  }
}


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
  const runtime = HerbRuntime.get()

  const resolve = (name: string): ScopedSetOptions => {
    const scope = runtime?.state.scopeFor(element, name)

    return scope ? { scope } : {}
  }

  return {
    get scope() {
      return runtime?.state.scopeFor(element) ?? null
    },
    get: (name) => runtime?.state.getState(name, resolve(name)) ?? null,
    set: (values) => {
      const first = Object.keys(values)[0]

      return first ? (runtime?.state.setState(values, resolve(first)) ?? false) : false
    },
    toggle: (name) => runtime?.state.toggle(name, resolve(name)) ?? false,
    increment: (name, by) => runtime?.state.increment(name, { ...resolve(name), by }) ?? false,
    decrement: (name, by) => runtime?.state.decrement(name, { ...resolve(name), by }) ?? false,
    reset: (name) => runtime?.state.reset(name, resolve(name)) ?? false,
    on: (name, listener) => runtime?.state.on(name, listener, resolve(name)) ?? (() => {}),
  }
}
