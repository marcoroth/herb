import { report } from "./report"

import { HERB_ATTRIBUTES } from "./attributes"
import { SLOT_EVENT } from "./slot-index"

import type { ApplyReport, Item, Payload, Region, Slot, SlotEventDetail, SlotIndex } from "./slot-index"

const VALUE_ELEMENTS = ["INPUT", "TEXTAREA", "SELECT"]
const IDLE: StateReport = { applied: 0, deferred: [], written: 0, restored: 0, stale: false, failed: false }

export const STATE_EVENT = "herb:state-change"
export const DEPENDENCIES_ATTRIBUTE = HERB_ATTRIBUTES.dependencies
export const DEPENDENCIES_SELECTOR = `template[${DEPENDENCIES_ATTRIBUTE}]`

export type StateMode = "identity" | "structural" | "derived"
export type StateKind = "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded"
export type StateValue = string | number | boolean | null
export type StatePersistence = "url" | "known" | "none"
export type StateTransport = (request: StateRequest, signal: AbortSignal) => Promise<Payload | null>

export interface DeclaredState {
  name: string
  kind: StateKind
  default: string
  scope: "region" | number
  line?: number | null
  column?: number | null
}

export interface StateManifest {
  version: string
  declarations: DeclaredState[]
  reads: Record<string, number[]>
  bound?: Record<string, number[]>
  conditionals: Record<string, { arms: ConditionalArm[]; else: number | null }>
  presence?: Record<string, [string, StateComparand] | [string, StateComparand, string]>
}

export type StateComparand = string | null | { state: string }

export type ConditionalArm = [string, StateComparand, number | null] | [string, StateComparand, number | null, string]

export interface StateScope {
  region: Region
  item: Item | null
}

export interface StateChangeDetail {
  name: string
  value: StateValue
  previous: StateValue
  file: string
  occurrence: number
  key: string | null
}

export interface ScopedSetOptions {
  scope?: StateScope | Element
}

export interface StateSlot {
  file: string
  version: string
  index: number
  mode: StateMode
}

export interface DependencyMap {
  state: Record<string, StateSlot[]>
  params?: Record<string, string>
  states?: Record<string, StateManifest>
}

export interface StateRequest {
  state: Record<string, string>
  changed: string[]
}

export interface StateOptions {
  transport?: StateTransport
  debounce?: number
  persist?: StatePersistence
  format?: string
}

export interface StateReport extends ApplyReport {
  written: number
  restored: number
  stale: boolean
  failed: boolean
}

interface Restore {
  slot: Slot
  value: string
}

export class SlotState {
  readonly #slots: SlotIndex
  readonly #values = new Map<string, string>()
  readonly #dependencies = new Map<string, StateSlot[]>()
  readonly #params = new Map<string, string>()
  readonly #declared = new Map<string, StateManifest>()
  readonly #writtenParams = new Set<string>()
  readonly #scoped = new Map<Region, Map<string, Map<string, StateValue>>>()
  readonly #seeds = new Map<Region, Map<string, Map<string, StateValue>>>()
  readonly #sequence = new Map<string, number>()
  readonly #options: Required<Omit<StateOptions, "transport">> & { transport: StateTransport }

  #pending = new Map<string, string>()
  #restores: Restore[] = []
  #previous = new Map<string, string | undefined>()
  #waiting: ((report: StateReport) => void)[] = []
  #timer: ReturnType<typeof setTimeout> | null = null
  #controller: AbortController | null = null
  #observer: MutationObserver | null = null

  constructor(slots: SlotIndex, options: StateOptions = {}) {
    this.#slots = slots

    this.#options = {
      transport: options.transport ?? this.#fetch.bind(this),
      debounce: options.debounce ?? 0,
      persist: options.persist ?? "url",
      format: options.format ?? "slots",
    }

    if (this.#persisted()) {
      this.#readLocation()
    }
  }

  #persisted(): boolean {
    return this.#options.persist !== "none"
  }

  #known(name: string): boolean {
    return this.#params.has(name) || this.#dependencies.has(name)
  }

  #transient(name: string): boolean {
    return this.#options.persist === "known" && !this.#known(name)
  }

  #forget(names: string[]): void {
    for (const name of names) {
      this.#values.delete(name)
      this.#writtenParams.add(name)
    }
  }

  get(key: string): string | undefined {
    return this.#values.get(key)
  }

  all(): Record<string, string> {
    return Object.fromEntries(this.#values)
  }

  names(): string[] {
    return [...this.#dependencies.keys()]
  }

  slotsFor(key: string): StateSlot[] {
    return this.#dependencies.get(this.#stateName(key)) ?? []
  }

  #stateName(name: string): string {
    return this.#params.get(name) ?? name
  }

  adopt(root: ParentNode = document): number {
    if (typeof document !== "undefined") document.addEventListener(SLOT_EVENT, this.#migrateItemState)

    const templates = [...root.querySelectorAll<HTMLTemplateElement>(DEPENDENCIES_SELECTOR)]

    for (const template of templates) {
      this.#merge(template.content.textContent ?? template.textContent ?? "")
      template.remove()
    }

    return templates.length
  }

  observe(root: Node = document.documentElement): void {
    if (typeof document === "undefined") return

    document.addEventListener(SLOT_EVENT, this.#syncProperty)
    document.addEventListener(SLOT_EVENT, this.#migrateItemState)
    document.addEventListener("input", this.#onBoundInput)
    document.addEventListener("change", this.#onBoundInput)
    document.addEventListener("reset", this.#onFormReset)

    if (typeof window !== "undefined" && this.#persisted()) {
      window.addEventListener("popstate", this.#onPopState)
    }

    this.#observer?.disconnect()
    this.#observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches(DEPENDENCIES_SELECTOR) || node.querySelector(DEPENDENCIES_SELECTOR)) {
            this.adopt()

            return
          }
        }
      }
    })

    this.#observer.observe(root, { childList: true, subtree: true })
  }

  disconnect(): void {
    this.#observer?.disconnect()
    this.#observer = null

    if (typeof document === "undefined") return

    document.removeEventListener(SLOT_EVENT, this.#syncProperty)
    document.removeEventListener(SLOT_EVENT, this.#migrateItemState)
    document.removeEventListener("input", this.#onBoundInput)
    document.removeEventListener("change", this.#onBoundInput)
    document.removeEventListener("reset", this.#onFormReset)

    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.#onPopState)
    }
  }

  set(key: string | Record<string, string>, value?: string): Promise<StateReport> {
    const changes = typeof key === "string" ? { [key]: value ?? "" } : key
    const changed = Object.keys(changes)

    for (const [name, next] of Object.entries(changes)) {
      this.#pending.set(name, next)
      this.#sequence.set(name, (this.#sequence.get(name) ?? 0) + 1)

      if (!this.#previous.has(name)) {
        this.#previous.set(name, this.#values.get(name))
      }

      this.#values.set(name, next)
    }

    this.#restores.push(...this.#optimistic(changed))

    if (this.#options.debounce <= 0) return this.#flush()

    if (this.#timer) clearTimeout(this.#timer)

    return new Promise((resolve) => {
      this.#waiting.push(resolve)
      this.#timer = setTimeout(() => {
        this.#timer = null
        void this.#flush()
      }, this.#options.debounce)
    })
  }

  async #flush(): Promise<StateReport> {
    const changes = this.#pending
    const restores = this.#restores
    const previous = this.#previous

    this.#pending = new Map()
    this.#restores = []
    this.#previous = new Map()

    if (changes.size === 0) {
      return this.#settle(IDLE)
    }

    const changed = [...changes.keys()]
    const taken = new Map(changed.map((name) => [name, this.#sequence.get(name) ?? 0]))
    const transient = [...this.#values.keys()].filter((name) => this.#transient(name))

    this.#controller?.abort()
    const controller = new AbortController()
    this.#controller = controller

    let payload: Payload | null = null

    try {
      payload = await this.#options.transport({ state: this.all(), changed }, controller.signal)
    } catch (error) {
      this.#forget(transient)

      if (controller.signal.aborted || this.#superseded(taken)) {
        return this.#settle({ ...IDLE, written: restores.length, stale: true })
      }

      this.#restore(restores)

      for (const [name, was] of previous) {
        if (was === undefined) this.#values.delete(name)
        else this.#values.set(name, was)
      }

      return this.#settle({ ...IDLE, written: restores.length, restored: restores.length, failed: true })
    }

    this.#forget(transient)

    if (this.#superseded(taken)) {
      return this.#settle({ ...IDLE, written: restores.length, stale: true })
    }

    const report = payload ? this.#slots.apply(payload) : { applied: 0, deferred: [] }

    if (this.#persisted()) {
      this.#writeLocation()
    }

    return this.#settle({ ...report, written: restores.length, restored: 0, stale: false, failed: false })
  }

  #settle(report: StateReport): StateReport {
    const waiting = this.#waiting

    this.#waiting = []

    for (const resolve of waiting) {
      resolve(report)
    }

    return report
  }

  #superseded(taken: Map<string, number>): boolean {
    for (const [name, sequence] of taken) {
      if ((this.#sequence.get(name) ?? 0) !== sequence) return true
    }

    return false
  }

  #optimistic(changed: string[]): Restore[] {
    const restores: Restore[] = []

    for (const name of changed) {
      const value = this.#values.get(name) ?? ""

      for (const entry of this.#dependencies.get(this.#stateName(name)) ?? []) {
        if (entry.mode !== "identity") continue

        for (const slot of this.#resolve(entry)) {
          const was = this.#slots.currentText(slot)

          if (this.#write(slot, value)) restores.push({ slot, value: was })
        }
      }
    }

    return restores
  }

  #restore(restores: Restore[]): void {
    for (const restore of [...restores].reverse()) {
      this.#write(restore.slot, restore.value)
    }
  }

  #write(slot: Slot, value: string): boolean {
    if (slot.anchor.kind !== "range" && slot.attribute) {
      return this.#slots.setAttribute(slot, value)
    }

    return this.#slots.setText(slot, value)
  }

  #resolve(entry: StateSlot): Slot[] {
    const slots: Slot[] = []

    for (const region of this.#slots.regionsFor(entry.file)) {
      if (region.version !== entry.version) continue

      const slot = region.slots.get(entry.index)

      if (slot) slots.push(slot)
    }

    return slots
  }

  #merge(json: string): void {
    if (!json.trim()) return

    let map: DependencyMap

    try {
      map = JSON.parse(json) as DependencyMap
    } catch {
      return
    }

    for (const [name, slots] of Object.entries(map.state ?? {})) {
      this.#dependencies.set(name, slots)
    }

    for (const [request, name] of Object.entries(map.params ?? {})) {
      this.#params.set(request, name)
    }

    for (const [file, manifest] of Object.entries(map.states ?? {})) {
      this.#declared.set(file, manifest)
    }
  }

  manifestFor(region: Region): StateManifest | null {
    const manifest = this.#declared.get(region.file)

    if (!manifest || manifest.version !== region.version) return null

    return manifest
  }

  scopeFor(target: Element | StateScope, name?: string): StateScope | null {
    if (!(target instanceof Element)) {
      if (!name || !target.item) return target

      const manifest = this.manifestFor(target.region)

      if (!manifest) return target

      const collection = collectionOf(target.region, target.item)
      const declaration = collection === null ? null : declared(manifest, name, collection)

      if (declaration !== null && declaration.scope === collection) return target
      if (declared(manifest, name, null) !== null) return { region: target.region, item: null }

      return target
    }

    for (const region of this.#slots.regions()) {
      if (!containsNode(region, target)) continue

      const manifest = this.manifestFor(region)
      if (!manifest) continue

      const item = enclosingItem(region, target)

      if (item && (!name || declared(manifest, name, item.collection) !== null)) {
        return { region, item: item.item }
      }

      if (!name || declared(manifest, name, null) !== null) return { region, item: null }
    }

    return null
  }

  declaredStates(scope: StateScope): DeclaredState[] {
    const manifest = this.manifestFor(scope.region)
    if (!manifest) return []

    const collection = scope.item ? collectionOf(scope.region, scope.item) : null

    return manifest.declarations.filter((declaration) =>
      declaration.scope === "region" || (collection !== null && declaration.scope === collection),
    )
  }

  getState(name: string, options: ScopedSetOptions = {}): StateValue {
    const resolved = this.#scope(options.scope, name)
    if (!resolved) return null

    return this.#valueOf(name, resolved)
  }

  setState(values: Record<string, StateValue>, options: ScopedSetOptions = {}): boolean {
    const names = Object.keys(values)
    if (names.length === 0) return false

    const resolved = this.#scope(options.scope, names[0])

    if (!resolved) {
      this.#reportUnknown(names[0], null)

      return false
    }

    const manifest = this.manifestFor(resolved.region)

    if (!manifest) {
      report({
        template: resolved.region.file,
        message: `the page was rendered by a different version of \`${resolved.region.file}\`, so its states cannot be resolved`,
        code: "herb-stale-version",
        severity: "warning",
        suggestion: "reload the page",
      })

      return false
    }

    const previous = new Map<string, StateValue>()
    const scopes = new Map<string, StateScope>()
    const groups = new Map<StateScope, string[]>()

    for (const name of names) {
      const target = this.scopeFor(resolved, name) ?? resolved

      if (this.#declaration(manifest, target, name) === null) {
        this.#reportUnknown(name, resolved)

        return false
      }

      const shared = [...groups.keys()].find(candidate => candidate.region === target.region && candidate.item === target.item) ?? target

      groups.set(shared, [...(groups.get(shared) ?? []), name])
      scopes.set(name, shared)
      previous.set(name, this.#valueOf(name, shared))
    }

    this.#slots.transaction(() => {
      for (const [name, value] of Object.entries(values)) {
        const target = scopes.get(name) ?? resolved

        this.#store(target, name, value)
        this.#writeValueSlots(manifest, target, name, value)
      }

      for (const [scope, grouped] of groups) {
        this.#writeConditionals(manifest, scope, grouped)
        this.#writePresence(manifest, scope, grouped)
      }
    }, { retain: false })

    for (const [name, value] of Object.entries(values)) {
      this.#announceState(scopes.get(name) ?? resolved, name, value, previous.get(name) ?? null)
    }

    return true
  }

  toggle(name: string, options: ScopedSetOptions = {}): boolean {
    this.#requireKind(name, options, "boolean", "toggle")

    const current = this.getState(name, options)

    return this.setState({ [name]: current !== true }, options)
  }

  increment(name: string, options: ScopedSetOptions & { by?: number } = {}): boolean {
    this.#requireKind(name, options, "integer", "increment")

    const current = this.getState(name, options)
    const base = typeof current === "number" ? current : 0

    return this.setState({ [name]: base + (options.by ?? 1) }, options)
  }

  decrement(name: string, options: ScopedSetOptions & { by?: number } = {}): boolean {
    return this.increment(name, { ...options, by: -(options.by ?? 1) })
  }

  reset(name: string, options: ScopedSetOptions = {}): boolean {
    const resolved = this.#scope(options.scope, name)
    if (!resolved) return false

    const seeded = this.#seeds.get(resolved.region)?.get(resolved.item?.key ?? "")?.get(name)

    return this.setState({ [name]: seeded ?? this.#defaultOf(name, resolved) }, options)
  }

  on(name: string, listener: (value: StateValue, previous: StateValue) => void, options: ScopedSetOptions = {}): () => void {
    const scope = options.scope ? this.#scope(options.scope, name) : null

    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<StateChangeDetail>).detail
      if (detail.name !== name) return

      if (scope) {
        if (detail.file !== scope.region.file || detail.occurrence !== scope.region.occurrence) return
        if ((scope.item?.key ?? null) !== detail.key) return
      }

      listener(detail.value, detail.previous)
    }

    document.addEventListener(STATE_EVENT, handler)

    return () => document.removeEventListener(STATE_EVENT, handler)
  }

  #reportUnknown(name: string, scope: StateScope | null): void {
    const known = scope ? this.declaredStates(scope).map((declaration) => declaration.name) : []
    const listed = known.length > 0 ? `the states in scope are ${known.join(", ")}` : "no scope on this page declares it"

    report({
      template: scope?.region.file ?? "",
      message: `nothing here declares the state \`${name}\`; ${listed}`,
      code: "herb-unknown-state",
      severity: "error",
      value: name,
    })
  }

  #scope(scope: StateScope | Element | undefined, name: string): StateScope | null {
    if (scope) return this.scopeFor(scope, name)

    for (const region of this.#slots.regions()) {
      const manifest = this.manifestFor(region)

      if (manifest && declared(manifest, name, null) !== null) return { region, item: null }
    }

    for (const region of this.#slots.regions()) {
      if (this.#declared.has(region.file) && !this.manifestFor(region)) return { region, item: null }
    }

    return null
  }

  #declaration(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null {
    const collection = scope.item ? collectionOf(scope.region, scope.item) : null

    return declared(manifest, name, collection)
  }

  #requireKind(name: string, options: ScopedSetOptions, kind: StateKind, operation: string): void {
    const resolved = this.#scope(options.scope, name)

    if (!resolved) return

    const manifest = this.manifestFor(resolved.region)
    const declaration = manifest ? this.#declaration(manifest, resolved, name) : null

    if (declaration && declaration.kind !== kind && declaration.kind !== "seeded") {
      const spot = declaration.line !== undefined && declaration.line !== null
        ? { location: { start: { line: declaration.line, column: declaration.column ?? 0 } } }
        : {}

      report({
        template: resolved.region.file,
        message: `${operation} on \`${name}\` did nothing, because \`${name}\` is a ${declaration.kind} and ${operation} needs a ${kind}`,
        code: "herb-state-type",
        severity: "error",
        value: name,
        suggestion: kind === "boolean" ? `set a value instead, or declare a boolean flag` : `use set with a ${kind} value`,
        ...spot,
      })
      throw new TypeError(`${operation} needs a ${kind} state, and \`${name}\` is declared as ${declaration.kind}`)
    }
  }

  #valueOf(name: string, scope: StateScope): StateValue {
    const stored = this.#scoped.get(scope.region)?.get(scope.item?.key ?? "")?.get(name)

    if (stored !== undefined) return stored

    const seeded = this.#seed(name, scope)

    return seeded !== undefined ? seeded : this.#defaultOf(name, scope)
  }

  #defaultOf(name: string, scope: StateScope): StateValue {
    const manifest = this.manifestFor(scope.region)
    const declaration = manifest ? this.#declaration(manifest, scope, name) : null

    if (!declaration) return null

    const parsed = parseLiteral(declaration.default)

    return parsed === undefined ? null : parsed
  }

  #seed(name: string, scope: StateScope): StateValue | undefined {
    const bucket = scoped(this.#seeds, scope)

    if (bucket.has(name)) {
      return bucket.get(name)
    }

    const manifest = this.manifestFor(scope.region)
    if (!manifest) return undefined

    let value = this.#seedFromValueSlot(manifest, scope, name)

    if (value === undefined) value = this.#seedFromConditional(manifest, scope, name)
    if (value === undefined) {
      const declaration = this.#declaration(manifest, scope, name)
      const parsed = declaration ? parseLiteral(declaration.default) : undefined

      value = parsed
    }

    if (value !== undefined) bucket.set(name, value)

    return value
  }

  #seedFromValueSlot(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.#declaration(manifest, scope, name)

    for (const index of manifest.reads[name] ?? []) {
      for (const slot of this.#scopedSlots(scope, index)) {
        if (slot.type === "boolean_attribute") {
          const entry = manifest.presence?.[String(index)]

          if (!entry || entry[1] !== null || slot.anchor.kind === "range" || !slot.attribute) continue

          return slot.anchor.element.hasAttribute(slot.attribute)
        }

        const text = slot.attribute && slot.anchor.kind !== "range"
          ? (slot.anchor.element.getAttribute(slot.attribute) ?? "")
          : this.#slots.currentText(slot)

        return coerceState(text, declaration?.kind ?? "string")
      }
    }

    return undefined
  }

  #seedFromConditional(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      const mentions = conditional.arms.some(([armName]) => armName === name)

      if (!mentions) continue

      for (const slot of this.#scopedSlots(scope, Number(indexKey))) {
        const arm = conditional.arms.find(([, , branch]) => branch === slot.branch)

        if (arm && arm[0] === name && arm[3] === undefined && typeof arm[1] !== "object") return arm[1] === null ? true : parseLiteral(arm[1])
        if (arm && arm[0] === name) return undefined
        if (slot.branch === conditional.else || slot.branch === null) {
          const declaration = this.#declaration(manifest, scope, name)

          return declaration?.kind === "boolean" ? false : undefined
        }
      }
    }

    return undefined
  }

  #store(scope: StateScope, name: string, value: StateValue): void {
    this.#seed(name, scope)

    scoped(this.#scoped, scope).set(name, value)
  }

  #writeValueSlots(manifest: StateManifest, scope: StateScope, name: string, value: StateValue): void {
    const text = printValue(value)

    for (const index of manifest.reads[name] ?? []) {
      for (const slot of this.#scopedSlots(scope, index)) {
        if (slot.type === "boolean_attribute") continue

        this.#write(slot, text)
      }
    }
  }

  #writePresence(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, [name, comparand, operator]] of Object.entries(manifest.presence ?? {})) {
      const against = typeof comparand === "object" && comparand !== null ? comparand.state : null

      if (!changed.includes(name) && (against === null || !changed.includes(against))) continue

      const value = this.#valueOf(name, scope)
      const present = armMatches(value, comparand, operator, (against) => this.#valueOf(against, scope))

      for (const slot of this.#scopedSlots(scope, Number(indexKey))) {
        this.#slots.setBooleanAttribute(slot, present)
      }
    }
  }

  #writeConditionals(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      const mentions = conditional.arms.some((arm) => armMentions(arm, changed))
      if (!mentions) continue

      const target = this.#targetBranch(conditional, scope)

      for (const slot of this.#scopedSlots(scope, Number(indexKey))) {
        if (!this.#slots.switchBranch(slot, target) && slot.branch !== target) {
          report({
            template: scope.region.file,
            message: `branch ${target ?? "else"} of slot ${slot.index} was never parked, so it cannot be shown`,
            code: "herb-no-parked-branch",
            severity: "warning",
            suggestion: "the template renders in server mode; compile it with `herb:slots client`",
          })
        }
      }
    }
  }

  #targetBranch(conditional: StateManifest["conditionals"][string], scope: StateScope): number | null {
    for (const [name, comparand, branch, operator] of conditional.arms) {
      const value = this.#valueOf(name, scope)

      if (armMatches(value, comparand, operator, (against) => this.#valueOf(against, scope))) return branch
    }

    return conditional.else
  }

  #scopedSlots(scope: StateScope, index: number): Slot[] {
    if (scope.item) {
      const slot = scope.item.slots.get(index)

      return slot ? [slot] : []
    }

    const region = scope.region.slots.get(index)
    if (region) return [region]

    const found: Slot[] = []

    for (const candidate of scope.region.slots.values()) {
      if (candidate.type !== "collection") continue

      for (const item of candidate.items.values()) {
        const slot = item.slots.get(index)

        if (slot) found.push(slot)
      }
    }

    return found
  }

  #announceState(scope: StateScope, name: string, value: StateValue, previous: StateValue): void {
    if (typeof document === "undefined") return

    document.dispatchEvent(
      new CustomEvent<StateChangeDetail>(STATE_EVENT, {
        detail: {
          name,
          value,
          previous,
          file: scope.region.file,
          occurrence: scope.region.occurrence,
          key: scope.item?.key ?? null,
        },
      }),
    )
  }

  #readLocation(): void {
    if (typeof window === "undefined") return

    this.#values.clear()

    for (const [name, value] of new URL(window.location.href).searchParams) {
      if (name !== "format") this.#values.set(name, value)
    }
  }

  #writeLocation(): void {
    if (typeof window === "undefined" || !window.history?.replaceState) return

    const url = new URL(window.location.href)

    for (const name of this.#writtenParams) url.searchParams.delete(name)

    this.#writtenParams.clear()

    for (const [name, value] of this.#values) {
      if (this.#options.persist === "known" && !this.#known(name)) continue

      url.searchParams.set(name, value)
      this.#writtenParams.add(name)
    }

    window.history.replaceState(window.history.state, "", url.toString())
  }

  #onBoundInput = (event: Event): void => {
    const element = event.target

    if (!(element instanceof Element)) return

    this.#syncBound(element)
  }

  #onFormReset = (event: Event): void => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) return

    setTimeout(() => {
      for (const element of form.elements) {
        this.#syncBound(element)
      }
    }, 0)
  }

  #syncBound(element: Element): void {
    const found = this.#boundNameOf(element)

    if (!found) return

    const declaration = this.#declaration(found.manifest, found.scope, found.name)
    const value = boundValue(element, declaration?.kind ?? "string")

    this.setState({ [found.name]: value }, { scope: found.scope })
  }

  resetBound(form: HTMLFormElement): void {
    for (const element of form.elements) {
      const found = this.#boundNameOf(element)

      if (found) this.reset(found.name, { scope: found.scope })
    }
  }

  #boundNameOf(element: Element): { name: string, scope: StateScope, manifest: StateManifest } | null {
    if (!VALUE_ELEMENTS.includes(element.tagName)) return null

    const scope = this.scopeFor(element)
    if (!scope) return null

    const manifest = this.manifestFor(scope.region)
    if (!manifest) return null

    for (const [name, indices] of Object.entries(manifest.bound ?? {})) {
      for (const index of indices) {
        for (const slot of this.#scopedSlots(scope, index)) {
          if (slot.anchor.kind === "range" || slot.anchor.element !== element) continue

          return { name, scope, manifest }
        }
      }
    }

    return null
  }

  #onPopState = (): void => {
    this.#readLocation()
  }

  #migrateItemState = (event: Event): void => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail

    if (detail.operation !== "item-rekeyed" || !detail.slot || !detail.key || detail.previousKey === null) return

    const region = this.#slots.regionOf(detail.slot)

    if (!region) return

    for (const store of [this.#scoped, this.#seeds]) {
      const buckets = store.get(region)
      const bucket = buckets?.get(detail.previousKey)

      if (!buckets || !bucket) continue

      buckets.delete(detail.previousKey)
      buckets.set(detail.key, bucket)
    }
  }

  #syncProperty = (event: Event): void => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail

    if (detail.operation !== "attribute") return

    const slot = detail.slot

    if (!slot || slot.anchor.kind === "range" || slot.attribute !== "value") return

    const element = slot.anchor.element

    if (!VALUE_ELEMENTS.includes(element.tagName)) return

    const written = element.getAttribute("value") ?? ""

    if ((element as HTMLInputElement).value !== written) {
      ;(element as HTMLInputElement).value = written
    }
  }

  async #fetch(request: StateRequest, signal: AbortSignal): Promise<Payload | null> {
    const url = new URL(window.location.href)

    for (const [name, value] of Object.entries(request.state)) url.searchParams.set(name, value)

    url.searchParams.set("format", this.#options.format)

    const response = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } })

    if (!response.ok) {
      throw new Error(`Herb state request failed with ${response.status}`)
    }

    return (await response.json()) as Payload
  }
}


function scoped(store: Map<Region, Map<string, Map<string, StateValue>>>, scope: StateScope): Map<string, StateValue> {
  let regionStore = store.get(scope.region)

  if (!regionStore) {
    regionStore = new Map()
    store.set(scope.region, regionStore)
  }

  const key = scope.item?.key ?? ""
  let bucket = regionStore.get(key)

  if (!bucket) {
    bucket = new Map()
    regionStore.set(key, bucket)
  }

  return bucket
}

function declared(manifest: StateManifest, name: string, collection: number | null): DeclaredState | null {
  const scoped_ = manifest.declarations.find(
    (declaration) => declaration.name === name && (collection !== null ? declaration.scope === collection : declaration.scope === "region"),
  )

  if (scoped_) return scoped_
  if (collection === null) return null

  return manifest.declarations.find((declaration) => declaration.name === name && declaration.scope === "region") ?? null
}

function containsNode(region: Region, target: Node): boolean {
  for (const range of region.ranges) {
    if (!range.end) continue

    const afterStart = range.start.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
    const beforeEnd = range.end.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING

    if (afterStart && beforeEnd) return true
  }

  return false
}

function enclosingItem(region: Region, target: Node): { item: Item; collection: number } | null {
  for (const slot of region.slots.values()) {
    if (slot.type !== "collection") continue

    for (const item of slot.items.values()) {
      const afterStart = item.start.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
      const beforeEnd = item.end.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING

      if (afterStart && beforeEnd) return { item, collection: slot.index }
    }
  }

  return null
}

function collectionOf(region: Region, item: Item): number | null {
  for (const slot of region.slots.values()) {
    if (slot.type !== "collection") continue
    if ([...slot.items.values()].includes(item)) return slot.index
  }

  return null
}

function parseLiteral(source: string): StateValue | undefined {
  const trimmed = source.trim()

  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (trimmed === "nil") return null
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  if (/^:[a-zA-Z_]\w*[?!]?$/.test(trimmed)) return trimmed.slice(1)
  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed) || /^'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, "$1")
  }

  return undefined
}

function printValue(value: StateValue): string {
  if (value === null) return ""
  if (value === true) return "true"
  if (value === false) return "false"

  return String(value)
}

export function coerceState(text: string, kind: StateKind): StateValue {
  if (kind === "boolean") return text === "true"
  if (kind === "integer") return /^-?\d+$/.test(text.trim()) ? Number(text.trim()) : 0
  if (kind === "nil") return text === "" ? null : text

  return text
}

export function boundValue(element: Element, kind: StateKind): StateValue {
  if (element instanceof HTMLInputElement && element.type === "checkbox") return element.checked

  const raw = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value

  return coerceState(raw, kind)
}

function armMentions(arm: ConditionalArm, changed: string[]): boolean {
  const [name, comparand] = arm

  if (changed.includes(name)) return true

  return typeof comparand === "object" && comparand !== null && changed.includes(comparand.state)
}

function armMatches(value: StateValue, comparand: StateComparand, operator: string | undefined, other: (name: string) => StateValue): boolean {
  if (comparand === null) return rubyTruthy(value)

  const literal = typeof comparand === "object" ? other(comparand.state) : parseLiteral(comparand)

  if (operator === undefined) return value === literal
  if (operator === "!=") return value !== literal
  if (typeof value !== "number" || typeof literal !== "number") return false

  switch (operator) {
    case ">": return value > literal
    case ">=": return value >= literal
    case "<": return value < literal
    case "<=": return value <= literal
    default: return false
  }
}

function rubyTruthy(value: StateValue): boolean {
  return value !== false && value !== null
}
