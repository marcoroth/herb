import { clearOnNavigation } from "./report"

import { SlotActions } from "./actions"
import { SlotIndex } from "./slot-index"
import { SlotMutations } from "./mutations"
import { SlotState } from "./state"

import type { MutationsOptions } from "./mutations"
import type { StateOptions } from "./state"

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
    if (existing) {
      return existing
    }

    const runtime = new HerbRuntime(CONSTRUCT, options)

    runtime.slots.observe()
    runtime.state.adopt()
    runtime.state.observe()
    runtime.actions.start()
    runtime.mutations.observe()
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
    this.mutations.unobserve()
    this.mutations.abort()
    this.actions.stop()
    this.stopClearing?.()
    this.stopClearing = null

    if (instance === this) {
      instance = null
    }
  }
}
