import { SlotIndex } from "./slot-index"
import { SlotState } from "./state"

import type { StateOptions } from "./state"

const CONSTRUCT = Symbol("HerbRuntime.start")

let instance: HerbRuntime | null = null

export interface RuntimeOptions {
  state?: StateOptions
}

export class HerbRuntime {
  public readonly slots: SlotIndex
  public readonly state: SlotState

  private constructor(token?: symbol, options: RuntimeOptions = {}) {
    if (token !== CONSTRUCT) {
      throw new TypeError("HerbRuntime is created by HerbRuntime.start()")
    }

    this.slots = new SlotIndex()
    this.state = new SlotState(this.slots, options.state)
  }

  static start(options: RuntimeOptions = {}): HerbRuntime {
    const existing = HerbRuntime.get()
    if (existing) return existing

    const runtime = new HerbRuntime(CONSTRUCT, options)

    runtime.slots.observe()
    runtime.state.adopt()
    runtime.state.observe()

    instance = runtime

    return runtime
  }

  static get(): HerbRuntime | null {
    return instance
  }

  stop(): void {
    this.slots.disconnect()
    this.state.disconnect()

    if (instance === this) {
      instance = null
    }
  }
}
