import { clearOnNavigation } from "./report"

import { ACTION_ATTRIBUTES } from "./actions"

import { SlotActions } from "./actions"
import { ElementObserver } from "./element-observer"
import { SlotIndex } from "./slot-index"
import { SlotMutations } from "./mutations"
import { SlotState } from "./state"

import type { MutationsOptions } from "./mutations"
import type { TemplateManifest } from "./manifests"
import type { StateOptions } from "./state"

const CONSTRUCT = Symbol("HerbRuntime.start")

let instance: HerbRuntime | null = null

export interface RuntimeOptions {
  state?: StateOptions
  mutations?: MutationsOptions
  manifests?: Record<string, TemplateManifest>
}

export class HerbRuntime {
  public readonly slots: SlotIndex
  public readonly state: SlotState
  public readonly mutations: SlotMutations
  public readonly actions: SlotActions

  private elements: ElementObserver | null = null
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

    if (options.manifests) {
      runtime.slots.adoptManifests(options.manifests)
    }

    const elements = new ElementObserver(ACTION_ATTRIBUTES)
    const root = document.documentElement

    runtime.elements = elements

    runtime.slots.observe(root, elements)
    runtime.state.adopt()
    runtime.state.observe(root, elements)
    runtime.actions.start(document, elements)
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
    this.elements?.disconnect()
    this.elements = null
    this.stopClearing?.()
    this.stopClearing = null

    if (instance === this) {
      instance = null
    }
  }
}
