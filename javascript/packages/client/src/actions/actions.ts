import { DIRECT_EVENTS, eventMatches, parseEventSpec } from "./events"
import { ACTION_ATTRIBUTES, ACTION_SCHEMA, ACTION_SELECTOR, HERB_ATTRIBUTES } from "../grammar/attributes"

import { Instructions } from "./instructions"
import { ElementObserver } from "../shared/element-observer"

import { report } from "../shared/report"
import { boundValue, coerceState } from "../state/values"
import { names, splitOutsideQuotes, unquote } from "../grammar/parsing"

import type { State } from "../state/state"
import type { StateScope } from "../state/types"
import type { StateValue } from "../state/values"
import type { InstructionsDelegate } from "./instructions"
import type { ElementObserverDelegate } from "../shared/element-observer"
import type { ActionName, ActionSchema } from "../grammar/attributes"
import type { Instruction, ResolvedDeclaration, StateGroups } from "./types"

interface Timing {
  timer?: ReturnType<typeof setTimeout>
  last?: number
}

export class Actions implements ElementObserverDelegate, InstructionsDelegate {
  private readonly state: State
  private readonly instructions = new Instructions(this)

  private events = new Set<string>()
  private globalEvents = new Set<string>()
  private direct = new Map<Element, () => void>()
  private elements: ElementObserver | null = null
  private unobserve: (() => void) | null = null
  private pinned: Map<string, StateScope> | null = null
  private listeners: [string, (event: Event) => void][] = []
  private globalListeners: [string, (event: Event) => void][] = []
  private timings = new WeakMap<Element, Map<string, Timing>>()

  constructor(state: State) {
    this.state = state
  }

  start(root: ParentNode = document, elements?: ElementObserver): void {
    this.scan(root)

    this.unobserve?.()

    this.elements = elements ?? new ElementObserver(ACTION_ATTRIBUTES)
    this.unobserve = this.elements.add(this)

    let observed: Node = document.documentElement

    if (root instanceof Element) {
      observed = root
    }

    this.elements.observe(observed)
  }

  nodesAdded(nodes: Node[]): void {
    for (const node of nodes) {
      if (node instanceof Element) {
        this.scan(node)
      }
    }
  }

  attributeChanged(element: Element): void {
    this.instructions.forget(element)

    this.scan(element)
  }

  stop(): void {
    this.unobserve?.()
    this.unobserve = null
    this.elements = null

    for (const [event, listener] of this.listeners) {
      document.removeEventListener(event, listener, true)
    }

    for (const [event, listener] of this.globalListeners) {
      window.removeEventListener(event, listener, true)
    }

    for (const detach of this.direct.values()) {
      detach()
    }

    this.listeners = []
    this.globalListeners = []
    this.events = new Set()
    this.globalEvents = new Set()
    this.direct = new Map()
  }

  scan(root: ParentNode | Element): void {
    const elements: Element[] = []

    if (root instanceof Element && root.matches(ACTION_SELECTOR)) {
      elements.push(root)
    }

    elements.push(...root.querySelectorAll(ACTION_SELECTOR))

    for (const element of elements) {
      for (const instruction of this.instructions.of(element)) {
        const spec = parseEventSpec(instruction.event)

        if (DIRECT_EVENTS.includes(spec.type)) {
          this.attach(element, spec.type)
        } else if (spec.global) {
          this.delegateGlobal(spec.type)
        } else {
          this.delegate(spec.type)
        }
      }

      this.instructions.validate(element)
    }
  }

  templateOf(element: Element): string {
    return this.state.scopeFor(element)?.region.file ?? ""
  }

  private delegate(event: string): void {
    if (this.events.has(event)) {
      return
    }

    this.events.add(event)

    const listener = (fired: Event): void => this.dispatch(fired)

    document.addEventListener(event, listener, true)
    this.listeners.push([event, listener])
  }

  private delegateGlobal(event: string): void {
    if (this.globalEvents.has(event)) {
      return
    }

    this.globalEvents.add(event)

    const listener = (fired: Event): void => this.dispatchGlobal(fired)

    window.addEventListener(event, listener, true)
    this.globalListeners.push([event, listener])
  }

  private dispatchGlobal(event: Event): void {
    for (const element of document.querySelectorAll(ACTION_SELECTOR)) {
      this.run(element, event, true)
    }
  }

  private attach(element: Element, _event: string): void {
    if (this.direct.has(element)) {
      return
    }

    const listener = (fired: Event): void => {
      this.run(element, fired)
    }

    for (const direct of DIRECT_EVENTS) {
      element.addEventListener(direct, listener)
    }

    this.direct.set(element, () => {
      for (const direct of DIRECT_EVENTS) {
        element.removeEventListener(direct, listener)
      }
    })
  }

  private dispatch(event: Event): void {
    const start = event.target

    if (!(start instanceof Element)) {
      return
    }

    let element: Element | null = start.closest(ACTION_SELECTOR)

    while (element) {
      if (this.run(element, event)) {
        return
      }

      element = element.parentElement?.closest(ACTION_SELECTOR) ?? null
    }
  }

  private run(element: Element, event: Event, global = false): boolean {
    let shortcut = false

    const pending = this.instructions.of(element).filter((instruction) => {
      const spec = parseEventSpec(instruction.event)

      if (spec.global !== global || !eventMatches(spec, event)) {
        return false
      }

      if (spec.outside && event.target instanceof Node && element.contains(event.target)) {
        return false
      }

      shortcut ||= spec.modifiers.length > 0

      return true
    })
    const handled = pending.length > 0

    if (shortcut && event.cancelable) {
      event.preventDefault()
    }

    this.pinned = null

    if (handled) {
      this.pinned = this.pinScopes(element, pending)
    }

    try {
      for (const entry of pending) {
        this.schedule(element, entry, event)
      }
    } finally {
      this.pinned = null
    }

    return handled
  }

  private schedule(element: Element, entry: Instruction, event: Event): void {
    const key = `${entry.action}:${entry.event}:${entry.rest}`
    const timing = this.timings.get(element) ?? new Map<string, Timing>()
    const held = timing.get(key) ?? {}

    this.timings.set(element, timing)
    timing.set(key, held)

    const throttle = this.timingOf(element, HERB_ATTRIBUTES.throttle)

    if (throttle !== null) {
      const now = Date.now()

      if (held.last !== undefined && now - held.last < throttle) {
        return
      }

      held.last = now
      this.execute(element, entry.action, entry.rest, event)

      return
    }

    const debounce = this.timingOf(element, HERB_ATTRIBUTES.debounce)

    if (debounce !== null) {
      if (held.timer !== undefined) {
        clearTimeout(held.timer)
      }

      held.timer = setTimeout(() => {
        held.timer = undefined

        const pinned = this.pinScopes(element, [entry])

        this.pinned = pinned

        try {
          this.execute(element, entry.action, entry.rest, event)
        } finally {
          this.pinned = null
        }
      }, debounce)

      return
    }

    this.execute(element, entry.action, entry.rest, event)
  }

  private timingOf(element: Element, attribute: string): number | null {
    const raw = element.getAttribute(attribute)

    if (raw === null) {
      return null
    }

    const parsed = Number(raw)

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }

  private execute(element: Element, action: ActionName, rest: string, event: Event): void {
    const schema: ActionSchema = ACTION_SCHEMA[action]

    try {
      if (schema.operation === "set") {
        this.set(element, rest, event)
      } else if (schema.operation === "toggle") {
        this.toggle(element, rest)
      } else if (schema.operation === "reset") {
        this.reset(element, rest)
      } else if (schema.operation === "action") {
        this.invoke(element, rest)
      } else {
        this.count(element, rest, schema.step ?? 1)
      }
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error
      }
    }
  }

  private pinScopes(element: Element, pending: Instruction[]): Map<string, StateScope> {
    const pinned = new Map<string, StateScope>()

    for (const entry of pending) {
      for (const raw of names(entry.rest)) {
        this.pin(pinned, element, raw.split("=")[0].trim())
      }
    }

    return pinned
  }

  private pin(pinned: Map<string, StateScope>, element: Element, name: string): void {
    if (name === "" || pinned.has(name)) {
      return
    }

    const scope = this.state.scopeFor(element, name)

    if (scope) {
      pinned.set(name, scope)
    }
  }

  declarationFor(element: Element, name: string): ResolvedDeclaration | null {
    return this.declaration(element, name)
  }

  private declaration(element: Element, name: string): ResolvedDeclaration | null {
    const scope = this.pinned?.get(name) ?? this.state.scopeFor(element, name)

    if (!scope) {
      if (this.state.refusedRegion(element)) {
        return null
      }

      report({
        template: this.templateOf(element),
        element,
        message: `nothing around this element declares the state \`${name}\``,
        code: "herb-unknown-state",
        severity: "error",
        value: name,
      })

      return null
    }

    const declaration = this.state.declaredStates(scope).find((candidate) => candidate.name === name)

    if (!declaration) {
      return null
    }

    return { scope, declaration }
  }

  private apply(groups: StateGroups): void {
    for (const [scope, values] of groups) {
      this.state.setState(values, { scope })
    }
  }

  private group(groups: StateGroups, scope: StateScope, name: string, value: StateValue): void {
    const values = groups.get(scope)

    if (values) {
      values[name] = value

      return
    }

    groups.set(scope, { [name]: value })
  }

  private set(element: Element, rest: string, event: Event): void {
    if (splitOutsideQuotes(rest, ",").length > 1) {
      return
    }

    const groups: StateGroups = new Map()
    const pair = this.pairOf(element, rest)

    if (!pair) {
      return
    }

    const resolved = this.declaration(element, pair.name)

    if (!resolved) {
      return
    }

    const assigned = this.assignedValue(element, pair.name, resolved, pair.raw, event)

    if (!assigned) {
      return
    }

    this.group(groups, resolved.scope, pair.name, assigned.value)
    this.apply(groups)
  }

  private pairOf(element: Element, assignment: string): { name: string; raw: string } | null {
    const separator = assignment.indexOf("=")

    if (separator < 1) {
      report({
        template: this.templateOf(element),
        element,
        message: `\`${assignment}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return null
    }

    return {
      name: assignment.slice(0, separator).trim(),
      raw: unquote(assignment.slice(separator + 1).trim()),
    }
  }

  private assignedValue(element: Element, name: string, resolved: ResolvedDeclaration, raw: string, event: Event): { value: StateValue } | null {
    const { scope, declaration } = resolved
    const kind = declaration.kind

    if (raw === "$value") {
      const target = event.target

      return { value: target instanceof Element ? boundValue(target, kind) : null }
    }

    if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
      report({
        template: scope.region.file,
        element,
        message: `\`${name}=${raw}\` does not parse as a ${kind}; \`${name}\` is declared as one`,
        code: "herb-state-type",
        severity: "error",
        value: name,
      })

      return null
    }

    return { value: coerceState(raw, kind) }
  }

  private toggle(element: Element, rest: string): void {
    const groups: StateGroups = new Map()

    for (const name of names(rest)) {
      const resolved = this.declaration(element, name)

      if (!resolved) {
        return
      }

      const { scope, declaration } = resolved

      if (declaration.kind !== "boolean" && declaration.kind !== "seeded") {
        report({
          template: scope.region.file,
          element,
          message: `\`${HERB_ATTRIBUTES.toggle}\` on \`${name}\` did nothing, because \`${name}\` is a ${declaration.kind} and toggling needs a boolean`,
          code: "herb-state-type",
          severity: "error",
          value: name,
        })

        return
      }

      this.group(groups, scope, name, this.state.getState(name, { scope }) !== true)
    }

    this.apply(groups)
  }

  private count(element: Element, rest: string, direction: number): void {
    const by = Number(element.getAttribute(HERB_ATTRIBUTES.by) ?? "1")

    let magnitude = 1

    if (Number.isFinite(by)) {
      magnitude = by
    }

    const step = direction * magnitude

    for (const name of names(rest)) {
      const resolved = this.declaration(element, name)
      if (!resolved) {
        return
      }

      this.state.increment(name, { scope: resolved.scope, by: step })
    }
  }

  private invoke(element: Element, rest: string): void {
    for (const name of names(rest)) {
      if (name === "$refresh") {
        void this.state.refresh()

        continue
      }

      report({
        template: this.templateOf(element),
        element,
        message: name.startsWith("$") ? `\`${name}\` is not a built-in action` : `\`${name}\` names a user-defined action, and those are not available yet`,
        code: "herb-invalid-action",
        severity: "error",
      })
    }
  }

  private reset(element: Element, rest: string): void {
    if (rest.trim() === "") {
      const scope = this.state.scopeFor(element)

      if (!scope) {
        return
      }

      for (const declaration of this.state.declaredStates(scope)) {
        this.state.reset(declaration.name, { scope: this.state.scopeFor(element, declaration.name) ?? scope })
      }

      return
    }

    for (const name of names(rest)) {
      const resolved = this.declaration(element, name)

      if (!resolved) {
        return
      }

      this.state.reset(name, { scope: resolved.scope })
    }
  }
}
