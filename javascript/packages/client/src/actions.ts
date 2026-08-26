import { ElementObserver } from "./element-observer"

import { DIRECT_EVENTS } from "./events"
import { ACTION_ATTRIBUTES, ACTION_NAMES, ACTION_SCHEMA, ACTION_SELECTOR, HERB_ATTRIBUTES } from "./attributes"

import { report } from "./report"
import { boundValue, coerceState } from "./values"
import { defaultEventFor } from "./events"
import { balancedQuotes, clauses, names, splitOutsideQuotes, unquote } from "./parsing"

import type { Clause } from "./parsing"
import type { StateValue } from "./values"
import type { ActionName, ActionSchema } from "./attributes"
import type { ElementObserverDelegate } from "./element-observer"
import type { DeclaredState, SlotState, StateScope, StateValues } from "./state"

export type StateGroups = Map<StateScope, StateValues>

export interface ResolvedDeclaration {
  scope: StateScope
  declaration: DeclaredState
}

interface Instruction {
  action: ActionName
  event: string
  rest: string
}

export class SlotActions implements ElementObserverDelegate {
  readonly #state: SlotState

  #events = new Set<string>()
  #parsed = new WeakMap<Element, Instruction[]>()
  #direct = new Map<Element, () => void>()
  #validated = new WeakSet<Element>()
  #elements: ElementObserver | null = null
  #unobserve: (() => void) | null = null
  #pinned: Map<string, StateScope> | null = null
  #listeners: [string, (event: Event) => void][] = []

  constructor(state: SlotState) {
    this.#state = state
  }

  start(root: ParentNode = document, elements?: ElementObserver): void {
    this.scan(root)

    this.#unobserve?.()

    this.#elements = elements ?? new ElementObserver(ACTION_ATTRIBUTES)
    this.#unobserve = this.#elements.add(this)

    let observed: Node = document.documentElement

    if (root instanceof Element) {
      observed = root
    }

    this.#elements.observe(observed)
  }

  nodesAdded(nodes: Node[]): void {
    for (const node of nodes) {
      if (node instanceof Element) {
        this.scan(node)
      }
    }
  }

  attributeChanged(element: Element): void {
    this.#parsed.delete(element)
    this.#validated.delete(element)

    this.scan(element)
  }

  stop(): void {
    this.#unobserve?.()
    this.#unobserve = null
    this.#elements = null

    for (const [event, listener] of this.#listeners) {
      document.removeEventListener(event, listener, true)
    }

    for (const detach of this.#direct.values()) {
      detach()
    }

    this.#listeners = []
    this.#events = new Set()
    this.#direct = new Map()
  }

  scan(root: ParentNode | Element): void {
    const elements: Element[] = []

    if (root instanceof Element && root.matches(ACTION_SELECTOR)) {
      elements.push(root)
    }

    elements.push(...root.querySelectorAll(ACTION_SELECTOR))

    for (const element of elements) {
      for (const instruction of this.#instructions(element)) {
        if (DIRECT_EVENTS.includes(instruction.event)) {
          this.#attach(element, instruction.event)
        } else {
          this.#delegate(instruction.event)
        }
      }

      this.#validate(element)
    }
  }

  #instructions(element: Element): Instruction[] {
    const held = this.#parsed.get(element)

    if (held) {
      return held
    }

    const parsed: Instruction[] = []

    for (const action of ACTION_NAMES) {
      const value = element.getAttribute(HERB_ATTRIBUTES[action])

      if (value === null) {
        continue
      }

      for (const clause of clauses(value)) {
        parsed.push({ action, event: clause.event ?? defaultEventFor(element), rest: clause.rest })
      }
    }

    this.#parsed.set(element, parsed)

    return parsed
  }

  #validate(element: Element): void {
    if (this.#validated.has(element)) {
      return
    }

    this.#validated.add(element)

    for (const name of ACTION_NAMES) {
      const attribute = HERB_ATTRIBUTES[name]
      const value = element.getAttribute(attribute)

      if (value === null) {
        continue
      }

      if (!balancedQuotes(value)) {
        report({
          template: this.#templateOf(element),
          element,
          message: `\`${attribute}="${value}"\` has an unbalanced quote`,
          code: "herb-invalid-action",
          severity: "error",
        })

        continue
      }

      for (const clause of clauses(value)) {
        this.#validateClause(element, name, clause)
      }
    }
  }

  #validateClause(element: Element, action: ActionName, clause: Clause): void {
    const schema: ActionSchema = ACTION_SCHEMA[action]
    const attribute = HERB_ATTRIBUTES[action]

    if (clause.event === "" || (clause.rest.trim() === "" && !schema.bare)) {
      let problem = "nothing after the event"

      if (clause.event === "") {
        problem = "no event before the arrow"
      }

      report({
        template: this.#templateOf(element),
        element,
        message: `\`${attribute}\` has a clause with ${problem}`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return
    }

    if (schema.operation === "set") {
      for (const assignment of splitOutsideQuotes(clause.rest, ",")) {
        this.#validateAssignment(element, assignment)
      }

      return
    }

    for (const name of names(clause.rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) {
        continue
      }

      const kind = resolved.declaration.kind

      if (schema.needs && kind !== schema.needs && kind !== "seeded") {
        this.#reportKind(resolved.scope.region.file, attribute, name, kind, schema.needs, element)
      }
    }
  }

  #validateAssignment(element: Element, assignment: string): void {
    const separator = assignment.indexOf("=")

    if (separator < 1) {
      report({
        template: this.#templateOf(element),
        element,
        message: `\`${assignment.trim()}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return
    }

    const name = assignment.slice(0, separator).trim()
    const raw = unquote(assignment.slice(separator + 1).trim())
    const resolved = this.#declaration(element, name)

    if (!resolved || raw === "$value") {
      return
    }

    const kind = resolved.declaration.kind

    if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
      report({
        template: resolved.scope.region.file,
        element,
        message: `\`${name}=${raw}\` does not parse as a ${kind}; \`${name}\` is declared as one`,
        code: "herb-state-type",
        severity: "error",
        value: name,
      })
    }
  }

  #reportKind(template: string, attribute: string, name: string, kind: string, wanted: string, element: Element | null = null): void {
    report({
      template,
      element,
      message: `\`${attribute}\` on \`${name}\` can never work, because \`${name}\` is a ${kind} and it needs a ${wanted}`,
      code: "herb-state-type",
      severity: "error",
      value: name,
    })
  }

  #templateOf(element: Element): string {
    return this.#state.scopeFor(element)?.region.file ?? ""
  }

  #delegate(event: string): void {
    if (this.#events.has(event)) {
      return
    }

    this.#events.add(event)

    const listener = (fired: Event): void => this.#dispatch(fired)

    document.addEventListener(event, listener, true)
    this.#listeners.push([event, listener])
  }

  #attach(element: Element, _event: string): void {
    if (this.#direct.has(element)) {
      return
    }

    const listener = (fired: Event): void => {
      this.#run(element, fired)
    }

    for (const direct of DIRECT_EVENTS) {
      element.addEventListener(direct, listener)
    }

    this.#direct.set(element, () => {
      for (const direct of DIRECT_EVENTS) {
        element.removeEventListener(direct, listener)
      }
    })
  }

  #dispatch(event: Event): void {
    const start = event.target

    if (!(start instanceof Element)) {
      return
    }

    let element: Element | null = start.closest(ACTION_SELECTOR)

    while (element) {
      if (this.#run(element, event)) {
        return
      }

      element = element.parentElement?.closest(ACTION_SELECTOR) ?? null
    }
  }

  #run(element: Element, event: Event): boolean {
    const pending = this.#instructions(element).filter((instruction) => instruction.event === event.type)

    const handled = pending.length > 0

    this.#pinned = null

    if (handled) {
      this.#pinned = this.#pinScopes(element, pending)
    }

    try {
      for (const entry of pending) {
        this.#execute(element, entry.action, entry.rest, event)
      }
    } finally {
      this.#pinned = null
    }

    return handled
  }

  #execute(element: Element, action: ActionName, rest: string, event: Event): void {
    const schema: ActionSchema = ACTION_SCHEMA[action]

    try {
      if (schema.operation === "set") {
        this.#set(element, rest, event)
      } else if (schema.operation === "toggle") {
        this.#toggle(element, rest)
      } else if (schema.operation === "reset") {
        this.#reset(element, rest)
      } else {
        this.#count(element, rest, schema.step ?? 1)
      }
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error
      }
    }
  }

  #pinScopes(element: Element, pending: Instruction[]): Map<string, StateScope> {
    const pinned = new Map<string, StateScope>()
    const bare = this.#state.scopeFor(element)

    if (bare) {
      for (const declaration of this.#state.declaredStates(bare)) {
        const scope = this.#state.scopeFor(element, declaration.name)

        if (scope) {
          pinned.set(declaration.name, scope)
        }
      }
    }

    for (const entry of pending) {
      for (const raw of names(entry.rest)) {
        const name = raw.split("=")[0].trim()

        if (name === "" || pinned.has(name)) {
          continue
        }

        const scope = this.#state.scopeFor(element, name)

        if (scope) {
          pinned.set(name, scope)
        }
      }
    }

    return pinned
  }

  #declaration(element: Element, name: string): ResolvedDeclaration | null {
    const scope = this.#pinned?.get(name) ?? this.#state.scopeFor(element, name)

    if (!scope) {
      report({
        template: this.#templateOf(element),
        element,
        message: `nothing around this element declares the state \`${name}\``,
        code: "herb-unknown-state",
        severity: "error",
        value: name,
      })

      return null
    }

    const declaration = this.#state
      .declaredStates(scope)
      .find((candidate) => candidate.name === name)

    if (!declaration) {
      return null
    }

    return { scope, declaration }
  }

  #apply(groups: StateGroups): void {
    for (const [scope, values] of groups) {
      this.#state.setState(values, { scope })
    }
  }

  #group(groups: StateGroups, scope: StateScope, name: string, value: StateValue): void {
    const values = groups.get(scope)

    if (values) {
      values[name] = value

      return
    }

    groups.set(scope, { [name]: value })
  }

  #set(element: Element, rest: string, event: Event): void {
    const groups: StateGroups = new Map()

    for (const assignment of splitOutsideQuotes(rest, ",")) {
      const separator = assignment.indexOf("=")

      if (separator < 1) {
        report({
          template: this.#templateOf(element),
          element,
          message: `\`${assignment}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
          code: "herb-invalid-action",
          severity: "error",
        })

        return
      }

      const name = assignment.slice(0, separator).trim()
      const raw = unquote(assignment.slice(separator + 1).trim())

      const resolved = this.#declaration(element, name)
      if (!resolved) {
        return
      }

      const { scope, declaration } = resolved
      const kind = declaration.kind

      if (raw === "$value") {
        const target = event.target

        let bound: StateValue = null

        if (target instanceof Element) {
          bound = boundValue(target, kind)
        }

        this.#group(groups, scope, name, bound)

        continue
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

        return
      }

      this.#group(groups, scope, name, coerceState(raw, kind))
    }

    this.#apply(groups)
  }

  #toggle(element: Element, rest: string): void {
    const groups: StateGroups = new Map()

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
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

      this.#group(groups, scope, name, this.#state.getState(name, { scope }) !== true)
    }

    this.#apply(groups)
  }

  #count(element: Element, rest: string, direction: number): void {
    const by = Number(element.getAttribute(HERB_ATTRIBUTES.by) ?? "1")

    let magnitude = 1

    if (Number.isFinite(by)) {
      magnitude = by
    }

    const step = direction * magnitude

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) {
        return
      }

      this.#state.increment(name, { scope: resolved.scope, by: step })
    }
  }

  #reset(element: Element, rest: string): void {
    if (rest.trim() === "") {
      const scope = this.#state.scopeFor(element)
      if (!scope) {
        return
      }

      for (const declaration of this.#state.declaredStates(scope)) {
        this.#state.reset(declaration.name, { scope: this.#state.scopeFor(element, declaration.name) ?? scope })
      }

      return
    }

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) {
        return
      }

      this.#state.reset(name, { scope: resolved.scope })
    }
  }
}
