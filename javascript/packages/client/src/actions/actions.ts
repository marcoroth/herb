import { DIRECT_EVENTS } from "./events"
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

export class Actions implements ElementObserverDelegate, InstructionsDelegate {
  private readonly state: State
  private readonly instructions = new Instructions(this)

  private events = new Set<string>()
  private direct = new Map<Element, () => void>()
  private elements: ElementObserver | null = null
  private unobserve: (() => void) | null = null
  private pinned: Map<string, StateScope> | null = null
  private listeners: [string, (event: Event) => void][] = []

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

    for (const detach of this.direct.values()) {
      detach()
    }

    this.listeners = []
    this.events = new Set()
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
        if (DIRECT_EVENTS.includes(instruction.event)) {
          this.attach(element, instruction.event)
        } else {
          this.delegate(instruction.event)
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

  private run(element: Element, event: Event): boolean {
    const pending = this.instructions.of(element).filter((instruction) => instruction.event === event.type)
    const handled = pending.length > 0

    this.pinned = null

    if (handled) {
      this.pinned = this.pinScopes(element, pending)
    }

    try {
      for (const entry of pending) {
        this.execute(element, entry.action, entry.rest, event)
      }
    } finally {
      this.pinned = null
    }

    return handled
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
    const groups: StateGroups = new Map()

    for (const assignment of splitOutsideQuotes(rest, ",")) {
      const pair = this.pairOf(element, assignment)

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
    }

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
