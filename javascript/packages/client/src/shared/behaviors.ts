import { report } from "./report"
import { elementOf } from "../markup/anchors"

import { ElementObserver } from "./element-observer"

import { TRANSITION_ATTRIBUTE } from "./transitions"

import type { ElementObserverDelegate } from "./element-observer"
import type { ScopedState } from "../state/for-element"
import type { Slots } from "../slots/slots"
import type { Outbox } from "../outbox/outbox"
import type { Built, Item, Slot, SlotsDelegate } from "../types"

export type BehaviorContextFor = (element: Element) => BehaviorContext

export interface BehaviorContext {
  state: ScopedState
  slots: Slots
  outbox: Outbox
}

export interface Move {
  from: DOMRect
  to: DOMRect
}

interface Definition {
  attribute: string
  behavior: Behavior
  connected: Set<Element>
  touched: Set<Element>
  named: WeakSet<Element>
}

export interface Behavior {
  connect?(element: Element, context: BehaviorContext): void
  enter?(element: Element, context: BehaviorContext): void
  valueChanged?(element: Element, value: string, context: BehaviorContext): void
  updated?(element: Element, slot: Slot, context: BehaviorContext): void
  moved?(element: Element, move: Move, context: BehaviorContext): void
  settled?(element: Element, context: BehaviorContext): void
  leave?(element: Element, context: BehaviorContext): Promise<void> | void
  disconnect?(element: Element, context: BehaviorContext): void
  transition?(element: Element, context: BehaviorContext): string | void
}

export class Behaviors implements ElementObserverDelegate, SlotsDelegate {
  private readonly definitions = new Map<string, Set<Definition>>()
  private readonly contexts = new WeakMap<Element, BehaviorContext>()
  private readonly contextFor: BehaviorContextFor
  private readonly slots: Slots
  private readonly rects = new Map<Element, DOMRect>()

  private fresh: Range[] = []
  private root: Node | null = null
  private elements: ElementObserver | null = null
  private unobserve: (() => void) | null = null
  private unsubscribe: (() => void) | null = null

  constructor(slots: Slots, contextFor: BehaviorContextFor) {
    this.slots = slots
    this.contextFor = contextFor
  }

  define(attribute: string, behavior: Behavior): () => void {
    const definition: Definition = { attribute, behavior, connected: new Set(), touched: new Set(), named: new WeakSet() }
    const defined = this.definitions.get(attribute) ?? new Set<Definition>()

    defined.add(definition)
    this.definitions.set(attribute, defined)
    this.elements?.watch([attribute])

    if (this.root) {
      this.connectIn([this.root], definition)
    }

    return () => this.undefine(definition)
  }

  observe(root: Node = document.documentElement, elements?: ElementObserver): void {
    this.unobserve?.()

    this.root = root
    this.elements = elements ?? new ElementObserver()
    this.unobserve = this.elements.add(this)
    this.unsubscribe ??= this.slots.subscribe(this)

    this.elements.watch([...this.definitions.keys()])
    this.elements.observe(root)

    for (const definition of this.all()) {
      this.connectIn([root], definition)
    }
  }

  disconnect(): void {
    this.unobserve?.()
    this.unobserve = null
    this.unsubscribe?.()
    this.unsubscribe = null
    this.elements = null
    this.root = null
    this.fresh = []

    for (const definition of this.all()) {
      for (const element of [...definition.connected]) {
        this.disconnectElement(definition, element)
      }
    }
  }

  nodesAdded(nodes: Node[]): void {
    for (const definition of this.all()) {
      this.connectIn(nodes, definition)
    }

    this.fresh = []
  }

  nodesRemoved(): void {
    for (const definition of this.all()) {
      for (const element of [...definition.connected]) {
        if (!element.isConnected) {
          this.disconnectElement(definition, element)
        }
      }
    }
  }

  attributeChanged(element: Element, name: string): void {
    const defined = this.definitions.get(name)

    if (!defined) {
      return
    }

    const value = element.getAttribute(name)

    for (const definition of defined) {
      if (value === null) {
        if (definition.connected.has(element)) {
          this.disconnectElement(definition, element)
        }
      } else if (!definition.connected.has(element)) {
        this.connectElement(definition, element)
      } else {
        this.guarded(definition, element, () => definition.behavior.valueChanged?.(element, value, this.context(element)))
        this.name(definition, element)
      }
    }
  }

  built(built: Built): void {
    for (const slot of built.branches) {
      this.fresh.push(this.slots.rangeOf(slot))
    }

    for (const { item } of built.items) {
      this.fresh.push(this.slots.rangeOf(item))
    }
  }

  holdBranch(slot: Slot): Promise<void> | void {
    return this.holdWithin(this.slots.rangeOf(slot))
  }

  holdItem(_slot: Slot, item: Item): Promise<void> | void {
    return this.holdWithin(this.slots.rangeOf(item))
  }

  valueWritten(slot: Slot): void {
    this.written(slot)
  }

  attributeWritten(slot: Slot): void {
    this.written(slot)
  }

  itemsMoving(_slot: Slot, items: Item[]): void {
    const ranges = items.map((item) => this.slots.rangeOf(item))

    for (const definition of this.all()) {
      if (!definition.behavior.moved) {
        continue
      }

      for (const element of definition.connected) {
        if (ranges.some((range) => range.intersectsNode(element))) {
          this.rects.set(element, element.getBoundingClientRect())
        }
      }
    }
  }

  itemsMoved(): void {
    const rects = [...this.rects]

    this.rects.clear()

    for (const definition of this.all()) {
      if (!definition.behavior.moved) {
        continue
      }

      for (const [element, from] of rects) {
        if (!definition.connected.has(element)) {
          continue
        }

        const to = element.getBoundingClientRect()

        if (from.top === to.top && from.left === to.left && from.width === to.width && from.height === to.height) {
          continue
        }

        definition.touched.add(element)
        this.guarded(definition, element, () => definition.behavior.moved?.(element, { from, to }, this.context(element)))
      }
    }
  }

  settled(): void {
    for (const definition of this.all()) {
      const touched = [...definition.touched]

      definition.touched.clear()

      for (const element of touched) {
        if (definition.connected.has(element)) {
          this.guarded(definition, element, () => definition.behavior.settled?.(element, this.context(element)))
        }
      }
    }
  }

  private written(slot: Slot): void {
    const anchored = elementOf(slot.anchor)
    const range = anchored ? null : this.slots.rangeOf(slot)

    for (const definition of this.all()) {
      if (!definition.behavior.updated) {
        continue
      }

      for (const element of definition.connected) {
        const inside = anchored ? element.contains(anchored) : range!.intersectsNode(element)

        if (!inside) {
          continue
        }

        definition.touched.add(element)
        this.guarded(definition, element, () => definition.behavior.updated?.(element, slot, this.context(element)))
      }
    }
  }

  private holdWithin(range: Range): Promise<void> | void {
    const holds: Promise<void>[] = []

    for (const definition of this.all()) {
      if (!definition.behavior.leave) {
        continue
      }

      for (const element of definition.connected) {
        if (!range.intersectsNode(element)) {
          continue
        }

        this.guarded(definition, element, () => {
          const held = definition.behavior.leave?.(element, this.context(element))

          if (held) {
            holds.push(held)
          }
        })
      }
    }

    if (holds.length > 0) {
      return Promise.allSettled(holds).then(() => undefined)
    }
  }

  private undefine(definition: Definition): void {
    const defined = this.definitions.get(definition.attribute)

    if (!defined?.delete(definition)) {
      return
    }

    if (defined.size === 0) {
      this.definitions.delete(definition.attribute)
    }

    for (const element of [...definition.connected]) {
      this.disconnectElement(definition, element)
    }
  }

  private all(): Definition[] {
    return [...this.definitions.values()].flatMap((defined) => [...defined])
  }

  private connectIn(nodes: Node[], definition: Definition): void {
    const selector = `[${CSS.escape(definition.attribute)}]`

    for (const node of nodes) {
      if (node instanceof Element && node.hasAttribute(definition.attribute)) {
        this.connectElement(definition, node)
      }

      if (!(node instanceof Element || node instanceof Document || node instanceof DocumentFragment)) {
        continue
      }

      for (const element of node.querySelectorAll(selector)) {
        this.connectElement(definition, element)
      }
    }
  }

  private connectElement(definition: Definition, element: Element): void {
    if (definition.connected.has(element)) {
      return
    }

    definition.connected.add(element)
    this.guarded(definition, element, () => definition.behavior.connect?.(element, this.context(element)))
    this.name(definition, element)

    if (definition.behavior.enter && this.fresh.some((range) => range.intersectsNode(element))) {
      this.guarded(definition, element, () => definition.behavior.enter?.(element, this.context(element)))
    }
  }

  private disconnectElement(definition: Definition, element: Element): void {
    if (!definition.connected.delete(element)) {
      return
    }

    definition.touched.delete(element)
    this.rects.delete(element)
    this.guarded(definition, element, () => definition.behavior.disconnect?.(element, this.context(element)))
  }

  private name(definition: Definition, element: Element): void {
    if (!definition.behavior.transition) {
      return
    }

    let name: string | void = undefined

    this.guarded(definition, element, () => {
      name = definition.behavior.transition?.(element, this.context(element))
    })

    if (typeof name === "string" && name !== "") {
      element.setAttribute(TRANSITION_ATTRIBUTE, name)
      definition.named.add(element)
    } else if (definition.named.has(element)) {
      element.removeAttribute(TRANSITION_ATTRIBUTE)
      definition.named.delete(element)
    }
  }

  private context(element: Element): BehaviorContext {
    let context = this.contexts.get(element)

    if (!context) {
      context = this.contextFor(element)
      this.contexts.set(element, context)
    }

    return context
  }

  private guarded(definition: Definition, element: Element, work: () => void): void {
    try {
      work()
    } catch (error) {
      report({
        template: "",
        element,
        message: `the behavior for \`${definition.attribute}\` threw ${error instanceof Error ? error.message : String(error)}`,
        code: "herb-behavior-error",
        severity: "error",
        value: definition.attribute,
      })
    }
  }
}
