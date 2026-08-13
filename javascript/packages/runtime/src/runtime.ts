import { SlotIndex } from "./slot-index"

const CONSTRUCT = Symbol("HerbRuntime.init")

let instance: HerbRuntime | null = null

export class HerbRuntime {
  static readonly SlotIndex = SlotIndex
  public readonly slots: SlotIndex

  private constructor(token?: symbol) {
    if (token !== CONSTRUCT) {
      throw new TypeError("HerbRuntime is created by HerbRuntime.init()")
    }

    this.slots = new SlotIndex()
  }

  static init(): HerbRuntime {
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
