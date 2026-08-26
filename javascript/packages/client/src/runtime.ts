import { clearOnNavigation } from "./shared/report"

import { ACTION_ATTRIBUTES } from "./grammar/attributes"

import { Slots } from "./slots/slots"
import { State } from "./state/state"
import { Outbox } from "./outbox/outbox"
import { Actions } from "./actions/actions"
import { ElementObserver } from "./shared/element-observer"

import type { StateOptions } from "./state/types"
import type { OutboxOptions } from "./outbox/types"
import type { TemplateManifest } from "./slots/manifests"

const CONSTRUCT = Symbol("Runtime.start")

let instance: Runtime | null = null

export interface RuntimeOptions {
  state?: StateOptions
  outbox?: OutboxOptions
  manifests?: Record<string, TemplateManifest>
}

export class Runtime {
  public readonly slots: Slots
  public readonly state: State
  public readonly outbox: Outbox
  public readonly actions: Actions

  private elements: ElementObserver | null = null
  private stopClearing: (() => void) | null = null

  private constructor(token?: symbol, options: RuntimeOptions = {}) {
    if (token !== CONSTRUCT) {
      throw new TypeError("Runtime is created by Runtime.start()")
    }

    this.slots = new Slots()
    this.state = new State(this.slots, options.state)
    this.outbox = new Outbox(this.slots, this.state, options.outbox)
    this.actions = new Actions(this.state)
  }

  static start(options: RuntimeOptions = {}): Runtime {
    const existing = Runtime.get()

    if (existing) {
      return existing
    }

    const runtime = new Runtime(CONSTRUCT, options)

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
    runtime.outbox.observe()
    runtime.stopClearing = clearOnNavigation()

    instance = runtime

    return runtime
  }

  static get(): Runtime | null {
    return instance
  }

  stop(): void {
    this.slots.disconnect()
    this.state.disconnect()
    this.outbox.unobserve()
    this.outbox.abort()
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
