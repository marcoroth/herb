import { SlotIndex } from "./slot-index"

const CONSTRUCT = Symbol("HerbRuntime.start")

let instance: HerbRuntime | null = null

export class HerbRuntime {
  public readonly slots: SlotIndex

  private constructor(token?: symbol) {
    if (token !== CONSTRUCT) {
      throw new TypeError("HerbRuntime is created by HerbRuntime.start()")
    }

    this.slots = new SlotIndex()
  }

  static start(): HerbRuntime {
    const existing = HerbRuntime.get()
    if (existing) return existing

    const runtime = new HerbRuntime(CONSTRUCT)

    runtime.slots.observe()

    instance = runtime

    return runtime
  }

  static get(): HerbRuntime | null {
    return instance
  }

  stop(): void {
    this.slots.disconnect()

    if (instance === this) {
      instance = null
    }
  }
}
