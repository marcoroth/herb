import { ACTION_NAMES, ACTION_SCHEMA, ACTION_SELECTOR, HERB_ATTRIBUTES } from "./attributes"
import { report } from "./report"
import { boundValue, coerceState } from "./state"

import type { ActionName, ActionSchema } from "./attributes"
import type { DeclaredState, SlotState, StateScope, StateValue } from "./state"

const DIRECT_EVENTS = ["mouseenter", "mouseleave"]

const DEFAULT_EVENTS: Record<string, string> = {
  form: "submit",
  input: "input",
  textarea: "input",
  select: "change",
  details: "toggle",
}

interface Clause {
  event: string | null
  rest: string
}

function defaultEventFor(element: Element): string {
  if (element instanceof HTMLInputElement && ["submit", "button", "reset"].includes(element.type)) {
    return "click"
  }

  return DEFAULT_EVENTS[element.localName] ?? "click"
}

export class SlotActions {
  readonly #state: SlotState

  #events = new Set<string>()
  #direct = new Map<Element, () => void>()
  #validated = new WeakSet<Element>()
  #observer: MutationObserver | null = null
  #listeners: [string, (event: Event) => void][] = []

  constructor(state: SlotState) {
    this.#state = state
  }

  start(root: ParentNode = document): void {
    this.scan(root)

    this.#observer?.disconnect()
    this.#observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) this.scan(node)
        }
      }
    })

    this.#observer.observe(root instanceof Element ? root : document.documentElement, {
      childList: true,
      subtree: true,
    })
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null

    for (const [event, listener] of this.#listeners) document.removeEventListener(event, listener, true)

    for (const detach of this.#direct.values()) detach()

    this.#listeners = []
    this.#events = new Set()
    this.#direct = new Map()
  }

  scan(root: ParentNode | Element): void {
    const elements = [
      ...(root instanceof Element && root.matches(ACTION_SELECTOR) ? [root] : []),
      ...root.querySelectorAll(ACTION_SELECTOR),
    ]

    for (const element of elements) {
      for (const name of ACTION_NAMES) {
        const value = element.getAttribute(HERB_ATTRIBUTES[name])

        if (value === null) continue

        for (const clause of clauses(value)) {
          const event = clause.event ?? defaultEventFor(element)

          if (DIRECT_EVENTS.includes(event)) {
            this.#attach(element, event)
          } else {
            this.#delegate(event)
          }
        }
      }

      this.#validate(element)
    }
  }

  #validate(element: Element): void {
    if (this.#validated.has(element)) return

    this.#validated.add(element)

    for (const name of ACTION_NAMES) {
      const attribute = HERB_ATTRIBUTES[name]
      const value = element.getAttribute(attribute)

      if (value === null) continue

      if (!balancedQuotes(value)) {
        report({
          template: this.#templateOf(element),
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
      report({
        template: this.#templateOf(element),
        message: `\`${attribute}\` has a clause with ${clause.event === "" ? "no event before the arrow" : "nothing after the event"}`,
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
      if (!resolved) continue

      const kind = resolved[1].kind

      if (schema.needs && kind !== schema.needs && kind !== "seeded") {
        this.#reportKind(resolved[0].region.file, attribute, name, kind, schema.needs)
      }
    }
  }

  #validateAssignment(element: Element, assignment: string): void {
    const separator = assignment.indexOf("=")

    if (separator < 1) {
      report({
        template: this.#templateOf(element),
        message: `\`${assignment.trim()}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return
    }

    const name = assignment.slice(0, separator).trim()
    const raw = unquote(assignment.slice(separator + 1).trim())
    const resolved = this.#declaration(element, name)

    if (!resolved || raw === "$value") return

    const kind = resolved[1].kind

    if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
      report({
        template: resolved[0].region.file,
        message: `\`${name}=${raw}\` does not parse as a ${kind}; \`${name}\` is declared as one`,
        code: "herb-state-type",
        severity: "error",
        value: name,
      })
    }
  }

  #reportKind(template: string, attribute: string, name: string, kind: string, wanted: string): void {
    report({
      template,
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
    if (this.#events.has(event)) return

    this.#events.add(event)

    const listener = (fired: Event): void => this.#dispatch(fired)

    document.addEventListener(event, listener, true)
    this.#listeners.push([event, listener])
  }

  #attach(element: Element, _event: string): void {
    if (this.#direct.has(element)) return

    const listener = (fired: Event): void => {
      this.#run(element, fired)
    }

    for (const direct of DIRECT_EVENTS) element.addEventListener(direct, listener)

    this.#direct.set(element, () => {
      for (const direct of DIRECT_EVENTS) element.removeEventListener(direct, listener)
    })
  }

  #dispatch(event: Event): void {
    const start = event.target

    if (!(start instanceof Element)) return

    let element: Element | null = start.closest(ACTION_SELECTOR)

    while (element) {
      if (this.#run(element, event)) return

      element = element.parentElement?.closest(ACTION_SELECTOR) ?? null
    }
  }

  #run(element: Element, event: Event): boolean {
    let handled = false

    for (const name of ACTION_NAMES) {
      const attribute = HERB_ATTRIBUTES[name]
      const value = element.getAttribute(attribute)

      if (value === null) continue

      for (const clause of clauses(value)) {
        if ((clause.event ?? defaultEventFor(element)) !== event.type) continue

        this.#execute(element, name, clause.rest, event)
        handled = true
      }
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
      if (!(error instanceof TypeError)) throw error
    }
  }

  #declaration(element: Element, name: string): [StateScope, DeclaredState] | null {
    const scope = this.#state.scopeFor(element, name)

    if (!scope) {
      report({
        template: "",
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

    return declaration ? [scope, declaration] : null
  }

  #apply(groups: Map<StateScope, Record<string, StateValue>>): void {
    for (const [scope, values] of groups) {
      this.#state.setState(values, { scope })
    }
  }

  #group(groups: Map<StateScope, Record<string, StateValue>>, scope: StateScope, name: string, value: StateValue): void {
    for (const [existing, values] of groups) {
      if (existing.region === scope.region && existing.item === scope.item) {
        values[name] = value

        return
      }
    }

    groups.set(scope, { [name]: value })
  }

  #set(element: Element, rest: string, event: Event): void {
    const groups = new Map<StateScope, Record<string, StateValue>>()

    for (const assignment of splitOutsideQuotes(rest, ",")) {
      const separator = assignment.indexOf("=")

      if (separator < 1) {
        report({
          template: "",
          message: `\`${assignment}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
          code: "herb-invalid-action",
          severity: "error",
        })

        return
      }

      const name = assignment.slice(0, separator).trim()
      const raw = unquote(assignment.slice(separator + 1).trim())

      const resolved = this.#declaration(element, name)
      if (!resolved) return

      const [scope, declaration] = resolved
      const kind = declaration.kind

      if (raw === "$value") {
        const target = event.target

        this.#group(groups, scope, name, target instanceof Element ? boundValue(target, kind) : null)

        continue
      }

      if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
        report({
          template: scope.region.file,
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
    const groups = new Map<StateScope, Record<string, StateValue>>()

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) return

      const [scope, declaration] = resolved

      if (declaration.kind !== "boolean" && declaration.kind !== "seeded") {
        report({
          template: scope.region.file,
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
    const step = direction * (Number.isFinite(by) ? by : 1)

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) return

      this.#state.increment(name, { scope: resolved[0], by: step })
    }
  }

  #reset(element: Element, rest: string): void {
    if (rest.trim() === "") {
      const scope = this.#state.scopeFor(element)
      if (!scope) return

      for (const declaration of this.#state.declaredStates(scope)) {
        this.#state.reset(declaration.name, { scope: this.#state.scopeFor(element, declaration.name) ?? scope })
      }

      return
    }

    for (const name of names(rest)) {
      const resolved = this.#declaration(element, name)
      if (!resolved) return

      this.#state.reset(name, { scope: resolved[0] })
    }
  }
}

function clauses(value: string): Clause[] {
  return splitOutsideQuotes(value.trim(), " ")
    .filter((part) => part.length > 0)
    .map((part) => {
      const arrow = part.indexOf("->")

      if (arrow === -1) {
        return { event: null, rest: part }
      }

      return { event: part.slice(0, arrow), rest: part.slice(arrow + 2) }
    })
}

function names(rest: string): string[] {
  return splitOutsideQuotes(rest, ",").map((name) => name.trim()).filter((name) => name.length > 0)
}

function balancedQuotes(source: string): boolean {
  let quoted = false

  for (let position = 0; position < source.length; position += 1) {
    if (source[position] === "'" && source[position - 1] !== "\\") {
      quoted = !quoted
    }
  }

  return !quoted
}

function splitOutsideQuotes(source: string, separator: string): string[] {
  const parts: string[] = []
  let current = ""
  let quoted = false

  for (let position = 0; position < source.length; position += 1) {
    const character = source[position]

    if (character === "'" && source[position - 1] !== "\\") {
      quoted = !quoted
      current += character

      continue
    }

    if (character === separator && !quoted) {
      parts.push(current)
      current = ""

      continue
    }

    current += character
  }

  parts.push(current)

  return parts
}

function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/\\'/g, "'")
  }

  return raw
}
