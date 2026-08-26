import { ElementObserver } from "./element-observer"
import { ServerState } from "./server-state"

import { HERB_ATTRIBUTES } from "./attributes"

import { report } from "./report"
import { elementOf, hostOf } from "./anchors"
import { armOf, matches, mentions } from "./conditions"
import { boundValue, coerceSeed, coerceState, kindArticle, printValue } from "./values"
import { scopeOf, scoped, declared, collectionIn, declarationSpot, declaredValue, comparandLiteral } from "./state-helpers.js"

import type { ElementObserverDelegate } from "./element-observer"

export const REGION_SCOPES = new WeakMap<Region, StateScope>()
export const ITEM_SCOPES = new WeakMap<Item, StateScope>()
export const VALUE_ELEMENTS = ["input", "textarea", "select"]

const BINDABLE_ELEMENTS = ["input", "textarea", "select", "option"]
const BINDABLE_ATTRIBUTES = ["value", "checked", "selected"]

export function bindable(slot: Slot): boolean {
  if (slot.type === "attribute_interpolation") {
    return false
  }

  const element = elementOf(slot.anchor)

  if (!element) {
    return false
  }

  if (slot.attribute) {
    return BINDABLE_ATTRIBUTES.includes(slot.attribute) && BINDABLE_ELEMENTS.includes(element.localName)
  }

  return element.localName === "textarea"
}

export const STATE_EVENT = "herb:state-change"
export const DEPENDENCIES_ATTRIBUTE = HERB_ATTRIBUTES.dependencies
export const DEPENDENCIES_SELECTOR = `template[${DEPENDENCIES_ATTRIBUTE}]`

import type { SlotIndex } from "./slot-index"
import type { ApplyReport, Built, Item, Payload, Region, Slot, SlotIndexDelegate } from "./types"
import type { StateKind, StateValue } from "./values"
import type { Conditional, StateCondition } from "./conditions"

export type StateMode = "identity" | "structural" | "derived"
export type StatePersistence = "url" | "known" | "none"
export type StateTransport = (request: StateRequest, signal: AbortSignal) => Promise<Payload | null>
export type StateListener = (value: StateValue, previous: StateValue) => void
export type StateWaiter = (report: StateReport) => void

export type StateValues = Record<string, StateValue>
export type SerializedState = Record<string, string>
export type StateIndices = Record<string, number[]>
export type ConditionalMap = Record<string, Conditional>
export type PresenceMap = Record<string, StateCondition>
export type ResolvedStateOptions = Required<Omit<StateOptions, "transport">> & { transport: StateTransport }

export type StateBucket = Map<string, StateValue>
export type ScopeStore = Map<Region, Map<string, StateBucket>>

export interface DeclaredState {
  name: string
  kind: StateKind
  default: string
  value?: StateValue
  derived?: StateCondition | null
  count?: StateCount | null
  scope: "region" | number
  line?: number | null
  column?: number | null
}

export interface StateCount {
  collection: number
  when: StateCondition | null
  by?: number
}

export interface StateManifest {
  version: string
  declarations: DeclaredState[]
  reads: StateIndices
  bound?: StateIndices
  conditionals: ConditionalMap
  presence?: PresenceMap
}

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

export interface CountOptions extends ScopedSetOptions {
  by?: number
}

export interface PlacedSlot {
  slot: Slot
  scope: StateScope
}

export interface BoundState {
  name: string
  scope: StateScope
  manifest: StateManifest
}

export interface StateSnapshot {
  name: string
  previous: StateValue
}

export interface StateChange extends StateSnapshot {
  value: StateValue
}

export interface StateSlot {
  file: string
  version: string
  index: number
}

export interface DependencyMap {
  state: Record<string, StateSlot[]>
  params?: Record<string, string>
  states?: Record<string, StateManifest>
}

export interface StateRequest {
  state: SerializedState
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

export class SlotState implements ElementObserverDelegate, SlotIndexDelegate {
  readonly #slots: SlotIndex
  readonly #server: ServerState
  readonly #declared = new Map<string, StateManifest>()
  readonly #scoped: ScopeStore = new Map()
  readonly #seeds: ScopeStore = new Map()
  readonly #options: ResolvedStateOptions

  #elements: ElementObserver | null = null
  #unobserveElements: (() => void) | null = null
  #unsubscribe: (() => void) | null = null

  constructor(slots: SlotIndex, options: StateOptions = {}) {
    this.#slots = slots

    this.#options = {
      transport: options.transport ?? ((request, signal) => this.#server.fetch(request, signal)),
      debounce: options.debounce ?? 0,
      persist: options.persist ?? "url",
      format: options.format ?? "slots",
    }

    this.#server = new ServerState(slots, this.#options)
    this.#unsubscribe = slots.subscribe(this)
  }

  set(key: string | SerializedState, value?: string): Promise<StateReport> {
    return this.#server.set(key, value)
  }

  built(built: Built): void {
    this.settle(built)
  }

  itemAdded(slot: Slot): void {
    this.#recountItems(slot)
  }

  itemRemoved(slot: Slot): void {
    this.#recountItems(slot)
  }

  settle(built: Built): void {
    for (const slot of built.branches) {
      this.#settleBranch(slot)
    }

    for (const { slot, item } of built.items) {
      this.#settleItem(slot, item)
    }
  }

  get(key: string): string | undefined {
    return this.#server.get(key)
  }

  all(): SerializedState {
    return this.#server.all()
  }

  names(): string[] {
    return this.#server.names()
  }

  slotsFor(key: string): StateSlot[] {
    return this.#server.slotsFor(key)
  }

  adopt(root: ParentNode = document): number {
    const templates = [...root.querySelectorAll<HTMLTemplateElement>(DEPENDENCIES_SELECTOR)]

    for (const template of templates) {
      this.#merge(template.content.textContent ?? template.textContent ?? "")
      template.remove()
    }

    return templates.length
  }

  observe(root: Node = document.documentElement, elements?: ElementObserver): void {
    if (typeof document === "undefined") {
      return
    }

    this.#unsubscribe ??= this.#slots.subscribe(this)

    document.addEventListener("input", this.#onBoundInput)
    document.addEventListener("change", this.#onBoundInput)
    document.addEventListener("reset", this.#onFormReset)

    if (typeof window !== "undefined" && this.#server.persisted()) {
      window.addEventListener("popstate", this.#onPopState)
    }

    this.#unobserveElements?.()

    this.#elements = elements ?? new ElementObserver()
    this.#unobserveElements = this.#elements.add(this)

    this.#elements.observe(root)
  }

  nodesAdded(nodes: Node[]): void {
    for (const node of nodes) {
      if (!(node instanceof Element)) {
        continue
      }

      if (node.matches(DEPENDENCIES_SELECTOR) || node.querySelector(DEPENDENCIES_SELECTOR)) {
        this.adopt()

        return
      }
    }
  }

  disconnect(): void {
    this.#unobserveElements?.()
    this.#unobserveElements = null
    this.#elements = null

    this.#unsubscribe?.()
    this.#unsubscribe = null

    if (typeof document === "undefined") {
      return
    }

    document.removeEventListener("input", this.#onBoundInput)
    document.removeEventListener("change", this.#onBoundInput)
    document.removeEventListener("reset", this.#onFormReset)

    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.#onPopState)
    }
  }

  #write(slot: Slot, value: string): boolean {
    if (elementOf(slot.anchor) && slot.attribute) {
      return this.#slots.setAttribute(slot, value)
    }

    return this.#slots.setText(slot, value)
  }

  #merge(json: string): void {
    if (!json.trim()) {
      return
    }

    let map: DependencyMap

    try {
      map = JSON.parse(json) as DependencyMap
    } catch {
      return
    }

    this.#server.adopt(map)

    for (const [file, manifest] of Object.entries(map.states ?? {})) {
      this.#declared.set(file, manifest)
    }
  }

  manifestFor(region: Region): StateManifest | null {
    const manifest = this.#slots.statesFor(region.file, region.version) ?? this.#declared.get(region.file)

    if (!manifest || manifest.version !== region.version) {
      return null
    }

    return manifest
  }

  scopeFor(target: Element | StateScope, name?: string): StateScope | null {
    if (!(target instanceof Element)) {
      if (!name || !target.item) {
        return target
      }

      const manifest = this.manifestFor(target.region)

      if (!manifest) {
        return target
      }

      const collection = target.item.collection.index

      let declaration: DeclaredState | null = null

      if (collection !== null) {
        declaration = declared(manifest, name, collection)
      }

      if (declaration !== null && declaration.scope === collection) {
        return target
      }

      if (declared(manifest, name, null) !== null) {
        return { region: target.region, item: null }
      }

      return target
    }

    const placed = new Map(this.#slots.placements(target).map((placement) => [placement.region, placement]))

    for (const region of this.#slots.regions()) {
      const placement = placed.get(region)

      if (!placement) {
        continue
      }

      const manifest = this.manifestFor(region)

      if (!manifest) {
        continue
      }

      let item = placement.item

      while (item) {
        if (!name || declared(manifest, name, item.collection.index) !== null) {
          return scopeOf(region, item)
        }

        item = item.collection.item
      }

      if (!name || declared(manifest, name, null) !== null) {
        return scopeOf(region)
      }
    }

    return null
  }

  declaredStates(scope: StateScope): DeclaredState[] {
    const manifest = this.manifestFor(scope.region)
    if (!manifest) {
      return []
    }

    const collection = collectionIn(scope)

    return manifest.declarations.filter((declaration) =>
      declaration.scope === "region" || (collection !== null && declaration.scope === collection),
    )
  }

  getState(name: string, options: ScopedSetOptions = {}): StateValue {
    const resolved = this.#scope(options.scope, name)
    if (!resolved) {
      return null
    }

    return this.#valueOf(name, resolved)
  }

  setState(values: StateValues, options: ScopedSetOptions = {}): boolean {
    const names = Object.keys(values)
    if (names.length === 0) {
      return false
    }

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
      const declaration = this.#declaration(manifest, target, name)

      if (declaration === null) {
        this.#reportUnknown(name, resolved)

        return false
      }

      if (declaration.derived) {
        report({
          template: resolved.region.file,
          message: `\`${name}\` is derived from \`${declaration.default}\`, so it cannot be written. Write the states it reads.`,
          code: "herb-state-derived",
          severity: "error",
          value: name,
        })

        return false
      }

      if (declaration.count) {
        report({
          template: resolved.region.file,
          message: `\`${name}\` is counted from the template's loop, so it cannot be written. Write the item states its condition reads.`,
          code: "herb-state-counted",
          severity: "error",
          value: name,
        })

        return false
      }

      groups.set(target, [...(groups.get(target) ?? []), name])
      scopes.set(name, target)
      previous.set(name, this.#valueOf(name, target))
    }

    const dependents = new Map<StateScope, StateSnapshot[]>()

    for (const [scope, grouped] of groups) {
      dependents.set(scope, this.#derivedDependents(manifest, scope, grouped).map((name) => ({ name, previous: this.#valueOf(name, scope) })))
    }

    const regionScope = scopeOf(resolved.region)
    const counted = this.#countDeclarations(manifest).map((declaration) => ({ name: declaration.name, previous: this.#valueOf(declaration.name, regionScope) }))
    const countDependents = this.#derivedDependents(manifest, regionScope, counted.map((entry) => entry.name)).map((name) => ({ name, previous: this.#valueOf(name, regionScope) }))

    for (const [name, value] of Object.entries(values)) {
      const target = scopes.get(name) ?? resolved

      this.#store(target, name, value)
      this.#writeValueSlots(manifest, target, name, value)
    }

    for (const [scope, grouped] of groups) {
      const recomputed: string[] = []

      for (const dependent of dependents.get(scope) ?? []) {
        const value = this.#valueOf(dependent.name, scope)

        if (value === dependent.previous) {
          continue
        }

        recomputed.push(dependent.name)
        this.#writeValueSlots(manifest, scope, dependent.name, value)
      }

      const changed = [...grouped, ...recomputed]

      this.#writeConditionals(manifest, scope, changed)
      this.#writePresence(manifest, scope, changed)
    }

    const recounted: string[] = []

    for (const entry of [...counted, ...countDependents]) {
      const value = this.#valueOf(entry.name, regionScope)

      if (value === entry.previous) {
        continue
      }

      recounted.push(entry.name)
      this.#writeValueSlots(manifest, regionScope, entry.name, value)
    }

    if (recounted.length > 0) {
      this.#writeConditionals(manifest, regionScope, recounted)
      this.#writePresence(manifest, regionScope, recounted)
    }

    for (const [name, value] of Object.entries(values)) {
      this.#announceState(scopes.get(name) ?? resolved, name, value, previous.get(name) ?? null)
    }

    for (const [scope, list] of dependents) {
      for (const dependent of list) {
        const value = this.#valueOf(dependent.name, scope)

        if (value !== dependent.previous) {
          this.#announceState(scope, dependent.name, value, dependent.previous)
        }
      }
    }

    for (const entry of [...counted, ...countDependents]) {
      const value = this.#valueOf(entry.name, regionScope)

      if (value !== entry.previous) {
        this.#announceState(regionScope, entry.name, value, entry.previous)
      }
    }

    return true
  }

  toggle(name: string, options: ScopedSetOptions = {}): boolean {
    this.#requireKind(name, options, "boolean", "toggle")

    const current = this.getState(name, options)

    return this.setState({ [name]: current !== true }, options)
  }

  increment(name: string, options: CountOptions = {}): boolean {
    this.#requireKind(name, options, "integer", "increment")

    const current = this.getState(name, options)

    let base = 0

    if (typeof current === "number") {
      base = current
    }

    return this.setState({ [name]: base + (options.by ?? 1) }, options)
  }

  decrement(name: string, options: CountOptions = {}): boolean {
    return this.increment(name, { ...options, by: -(options.by ?? 1) })
  }

  reset(name: string, options: ScopedSetOptions = {}): boolean {
    const resolved = this.#scope(options.scope, name)
    if (!resolved) {
      return false
    }

    const seeded = this.#seeds.get(resolved.region)?.get(resolved.item?.key ?? "")?.get(name)

    return this.setState({ [name]: seeded ?? this.#defaultOf(name, resolved) }, options)
  }

  on(name: string, listener: StateListener, options: ScopedSetOptions = {}): () => void {
    let scope: StateScope | null = null

    if (options.scope) {
      scope = this.#scope(options.scope, name)
    }

    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<StateChangeDetail>).detail
      if (detail.name !== name) {
        return
      }

      if (scope) {
        if (detail.file !== scope.region.file || detail.occurrence !== scope.region.occurrence) {
          return
        }

        if ((scope.item?.key ?? null) !== detail.key) {
          return
        }
      }

      listener(detail.value, detail.previous)
    }

    document.addEventListener(STATE_EVENT, handler)

    return () => document.removeEventListener(STATE_EVENT, handler)
  }

  #reportUnknown(name: string, scope: StateScope | null): void {
    let known: string[] = []

    if (scope) {
      known = this.declaredStates(scope).map((declaration) => declaration.name)
    }

    let listed = "no scope on this page declares it"

    if (known.length > 0) {
      listed = `the states in scope are ${known.join(", ")}`
    }

    report({
      template: scope?.region.file ?? this.#slots.regions()[0]?.file ?? "",
      message: `nothing here declares the state \`${name}\`; ${listed}`,
      code: "herb-unknown-state",
      severity: "error",
      value: name,
    })
  }

  #scope(scope: StateScope | Element | undefined, name: string): StateScope | null {
    if (scope) {
      return this.scopeFor(scope, name)
    }

    for (const region of this.#slots.regions()) {
      const manifest = this.manifestFor(region)

      if (manifest && declared(manifest, name, null) !== null) {
        return scopeOf(region)
      }
    }

    for (const region of this.#slots.regions()) {
      if (this.#declared.has(region.file) && !this.manifestFor(region)) {
        return scopeOf(region)
      }
    }

    return null
  }

  #declaration(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null {
    const collection = collectionIn(scope)

    return declared(manifest, name, collection)
  }

  #requireKind(name: string, options: ScopedSetOptions, kind: StateKind, operation: string): void {
    const resolved = this.#scope(options.scope, name)

    if (!resolved) {
      return
    }

    const declaration = this.#declarationIn(resolved, name)

    if (declaration && declaration.kind !== kind && declaration.kind !== "seeded") {
      let suggestion = `use set with a ${kind} value`

      if (kind === "boolean") {
        suggestion = "set a value instead, or declare a boolean flag"
      }

      report({
        template: resolved.region.file,
        message: `${operation} on \`${name}\` did nothing, because \`${name}\` is a ${declaration.kind} and ${operation} needs a ${kind}`,
        code: "herb-state-type",
        severity: "error",
        value: name,
        suggestion,
        ...declarationSpot(declaration),
      })
      throw new TypeError(`${operation} needs a ${kind} state, and \`${name}\` is declared as ${declaration.kind}`)
    }
  }

  #valueOf(name: string, at: StateScope): StateValue {
    const scope = this.scopeFor(at, name) ?? at
    const declaration = this.#declarationIn(scope, name)

    if (declaration?.count) {
      return this.#countValue(declaration, scope)
    }

    if (declaration?.derived) {
      return this.#deriveValue(declaration, scope)
    }

    const stored = this.#scoped.get(scope.region)?.get(scope.item?.key ?? "")?.get(name)

    if (stored !== undefined) {
      return stored
    }

    const seeded = this.#seed(name, scope)

    if (seeded !== undefined) {
      return seeded
    }

    return this.#defaultOf(name, scope)
  }

  #deriveValue(declaration: DeclaredState, scope: StateScope): StateValue {
    const entry = declaration.derived

    if (entry === undefined || entry === null) {
      return null
    }

    if (declaration.kind !== "boolean" && Array.isArray(entry) && entry.length === 2 && entry[1] === null) {
      return this.#valueOf(entry[0], scope)
    }

    return matches(entry, (name) => this.#valueOf(name, scope))
  }

  #countDeclarations(manifest: StateManifest): DeclaredState[] {
    return manifest.declarations.filter((declaration) => declaration.count)
  }

  #lastCounts = new WeakMap<Region, StateBucket>()

  #countValue(declaration: DeclaredState, scope: StateScope): StateValue {
    const count = declaration.count

    if (count === undefined || count === null) {
      return null
    }

    const base = declaredValue(declaration)
    const slot = scope.region.slots.get(count.collection)

    let start = 0

    if (typeof base === "number") {
      start = base
    }

    if (!slot) {
      return start
    }

    const items = slot.items

    let counted = 0

    for (const item of items.values()) {
      const itemScope = scopeOf(scope.region, item)

      if (count.when === null || count.when === undefined || matches(count.when, (name) => this.#valueOf(name, itemScope))) {
        counted += 1
      }
    }

    return start + counted * (count.by ?? 1)
  }

  #derivedDependents(manifest: StateManifest, scope: StateScope, written: string[]): string[] {
    const collection = collectionIn(scope)
    const changed = new Set(written)
    const dependents: string[] = []

    for (const declaration of manifest.declarations) {
      if (!declaration.derived) {
        continue
      }

      let matches = declaration.scope === "region"

      if (collection !== null) {
        matches = declaration.scope === collection
      }

      if (!matches) {
        continue
      }

      if (!mentions(declaration.derived, [...changed])) {
        continue
      }

      dependents.push(declaration.name)
      changed.add(declaration.name)
    }

    return dependents
  }

  #defaultOf(name: string, scope: StateScope): StateValue {
    const declaration = this.#declarationIn(scope, name)

    if (!declaration) {
      return null
    }

    const parsed = declaredValue(declaration)

    if (parsed === undefined) {
      return null
    }

    return parsed
  }

  declares(scope: StateScope, name: string): boolean {
    return this.#declarationIn(this.scopeFor(scope, name) ?? scope, name) !== null
  }

  #declarationIn(scope: StateScope, name: string): DeclaredState | null {
    const manifest = this.manifestFor(scope.region)

    if (!manifest) {
      return null
    }

    return this.#declaration(manifest, scope, name)
  }

  #seed(name: string, scope: StateScope): StateValue | undefined {
    const bucket = scoped(this.#seeds, scope)

    if (bucket.has(name)) {
      return bucket.get(name)
    }

    const manifest = this.manifestFor(scope.region)
    if (!manifest) {
      return undefined
    }

    let value = this.#shippedSeed(manifest, scope, name)

    if (value === undefined) {
      value = this.#seedFromValueSlot(manifest, scope, name)
    }

    if (value === undefined) {
      value = this.#seedFromConditional(manifest, scope, name)
    }

    if (value === undefined) {
      const declaration = this.#declaration(manifest, scope, name)

      if (declaration) {
        value = declaredValue(declaration)
      }
    }

    if (value !== undefined) {
      bucket.set(name, value)
    }

    return value
  }

  #shippedSeed(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.#declaration(manifest, scope, name)

    if (!declaration || declaration.derived || declaration.count) {
      return undefined
    }

    const channel = scope.item?.seeds ?? scope.region.seeds
    const shipped = scope.item?.seeds?.[name] ?? scope.region.seeds?.[name]

    if (shipped === undefined) {
      if (channel && declaredValue(declaration) === undefined) {
        this.#reportSeed(scope, declaration, `the server shipped no value for \`${name}\`; its rendered value was not a boolean, number, string, or nil, so the client falls back to what the page shows`, "seed the state with a primitive, since that is all a state can hold")
      }

      return undefined
    }

    const coerced = coerceSeed(shipped, declaration.kind)

    if (coerced === undefined) {
      this.#reportSeed(scope, declaration, `the server shipped ${JSON.stringify(shipped)} for \`${name}\`, which is declared as ${kindArticle(declaration.kind)}, and the client cannot read it as one`, `seed the state with ${kindArticle(declaration.kind)}`)

      return undefined
    }

    if (coerced !== shipped) {
      this.#reportSeed(scope, declaration, `the server shipped ${JSON.stringify(shipped)} for \`${name}\`, which is declared as ${kindArticle(declaration.kind)}, so the client coerced it to ${JSON.stringify(coerced)}`, `seed the state with ${kindArticle(declaration.kind)}`)
    }

    return coerced
  }

  #reportedSeeds = new WeakMap<Region, Set<string>>()

  #reportSeed(scope: StateScope, declaration: DeclaredState, message: string, suggestion: string): void {
    const reported = this.#reportedSeeds.get(scope.region) ?? new Set<string>()
    const key = `${scope.item?.key ?? ""}:${declaration.name}`

    if (reported.has(key)) {
      return
    }

    reported.add(key)
    this.#reportedSeeds.set(scope.region, reported)

    report({
      template: scope.region.file,
      message,
      code: "herb-state-type",
      severity: "warning",
      value: declaration.name,
      suggestion,
      ...declarationSpot(declaration),
    })
  }

  #seedFromValueSlot(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.#declaration(manifest, scope, name)

    for (const index of manifest.reads[name] ?? []) {
      for (const slot of this.#scopedSlots(scope, index)) {
        const element = elementOf(slot.anchor)

        if (slot.type === "boolean_attribute") {
          const entry = manifest.presence?.[String(index)]

          if (!entry || !Array.isArray(entry) || entry[1] !== null || !element || !slot.attribute) {
            continue
          }

          return element.hasAttribute(slot.attribute)
        }

        return coerceState(this.#slots.currentText(slot), declaration?.kind ?? "string")
      }
    }

    return undefined
  }

  #seedFromConditional(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      const arms = conditional.arms.map((entry) => armOf(entry))

      if (!arms.some((arm) => Array.isArray(arm.condition) && arm.condition[0] === name)) {
        continue
      }

      for (const slot of this.#scopedSlots(scope, Number(indexKey))) {
        const arm = arms.find((candidate) => candidate.branch === slot.branch)
        const condition = arm && Array.isArray(arm.condition) ? arm.condition : null

        if (condition && condition[0] === name && condition[2] === undefined) {
          if (condition[1] === null) {
            return true
          }

          return comparandLiteral(condition[1])
        }

        if (condition && condition[0] === name) {
          return undefined
        }

        if (slot.branch === conditional.else || slot.branch === null) {
          const declaration = this.#declaration(manifest, scope, name)

          if (declaration?.kind === "boolean") {
            return false
          }

          return undefined
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
        if (slot.type === "boolean_attribute") {
          continue
        }

        this.#write(slot, text)
        this.#slots.claim(slot)
      }
    }
  }

  #writePresence(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, entry] of Object.entries(manifest.presence ?? {})) {
      if (!mentions(entry, changed)) {
        continue
      }

      for (const placed of this.#placedSlots(scope, Number(indexKey))) {
        const present = matches(entry, (name) => this.#valueOf(name, placed.scope))

        this.#slots.setBooleanAttribute(placed.slot, present)
        this.#slots.claim(placed.slot)
      }
    }
  }

  #writeConditionals(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      if (!conditional.arms.some((arm) => mentions(armOf(arm).condition, changed))) {
        continue
      }

      for (const placed of this.#placedSlots(scope, Number(indexKey))) {
        const slot = placed.slot
        const target = this.#targetBranch(conditional, placed.scope)

        if (!this.#slots.switchBranch(slot, target) && slot.branch !== target) {
          report({
            template: scope.region.file,
            element: hostOf(slot.anchor),
            message: `branch ${target ?? "else"} of slot ${slot.index} was never parked, so it cannot be shown`,
            code: "herb-no-parked-branch",
            severity: "warning",
            suggestion: "the template renders in server mode; compile it with `herb:slots client`",
          })
        }
      }
    }
  }

  #targetBranch(conditional: Conditional, scope: StateScope): number | null {
    const valueOf = (name: string) => this.#valueOf(name, scope)

    for (const entry of conditional.arms) {
      const arm = armOf(entry)

      if (matches(arm.condition, valueOf)) {
        return arm.branch
      }
    }

    return conditional.else
  }

  #scopedSlots(scope: StateScope, index: number): Slot[] {
    return this.#placedSlots(scope, index).map((placed) => placed.slot)
  }

  #placedSlots(scope: StateScope, index: number): PlacedSlot[] {
    if (scope.item) {
      const slot = scope.item.slots.get(index)

      if (!slot) {
        return []
      }

      return [{ slot, scope }]
    }

    const region = scope.region.slots.get(index)

    if (region) {
      return [{ slot: region, scope }]
    }

    const found: PlacedSlot[] = []

    for (const candidate of scope.region.slots.values()) {
      if (candidate.type !== "collection") {
        continue
      }

      for (const item of candidate.items.values()) {
        const slot = item.slots.get(index)

        if (slot) {
          found.push({ slot, scope: { region: scope.region, item } })
        }
      }
    }

    return found
  }

  #announceState(scope: StateScope, name: string, value: StateValue, previous: StateValue): void {
    if (typeof document === "undefined") {
      return
    }

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

  #onBoundInput = (event: Event): void => {
    const element = event.target

    if (!(element instanceof Element)) {
      return
    }

    this.#syncBound(element)
  }

  #onFormReset = (event: Event): void => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) {
      return
    }

    setTimeout(() => {
      for (const element of form.elements) {
        this.#syncBound(element)
      }
    }, 0)
  }

  #syncBound(element: Element): void {
    const found = this.#boundNameOf(element)

    if (!found) {
      return
    }

    const declaration = this.#declaration(found.manifest, found.scope, found.name)
    const value = boundValue(element, declaration?.kind ?? "string")

    this.setState({ [found.name]: value }, { scope: found.scope })
  }

  resetBound(form: HTMLFormElement): void {
    for (const element of form.elements) {
      const found = this.#boundNameOf(element)

      if (found) {
        this.reset(found.name, { scope: found.scope })
      }
    }
  }

  #boundNameOf(element: Element): BoundState | null {
    if (!VALUE_ELEMENTS.includes(element.localName)) {
      return null
    }

    const scope = this.scopeFor(element)
    if (!scope) {
      return null
    }

    const manifest = this.manifestFor(scope.region)
    if (!manifest) {
      return null
    }

    const shipped = manifest.bound

    for (const [name, indices] of Object.entries(shipped ?? manifest.reads ?? {})) {
      for (const index of indices) {
        for (const slot of this.#scopedSlots(scope, index)) {
          if (elementOf(slot.anchor) !== element) {
            continue
          }

          if (!shipped && !bindable(slot)) {
            continue
          }

          return { name, scope, manifest }
        }
      }
    }

    return null
  }

  #onPopState = (): void => {
    this.#server.readLocation()
  }

  #recountItems(slot: Slot): void {
    const region = this.#slots.regionOf(slot)

    if (!region) {
      return
    }

    const manifest = this.manifestFor(region)

    if (!manifest) {
      return
    }

    if (!this.#countDeclarations(manifest).some((declaration) => declaration.count?.collection === slot.index)) {
      return
    }

    if (this.#recountQueued.has(region)) {
      return
    }

    this.#recountQueued.add(region)

    queueMicrotask(() => {
      this.#recountQueued.delete(region)
      this.#recountRegion(region)
    })
  }

  #recountRegion(region: Region): void {
    const manifest = this.manifestFor(region)

    if (!manifest) {
      return
    }

    const regionScope = scopeOf(region)
    const changed: StateChange[] = []

    for (const declaration of this.#countDeclarations(manifest)) {
      const previous = this.#lastCounts.get(region)?.get(declaration.name) ?? null
      const value = this.#valueOf(declaration.name, regionScope)

      if (value === previous) {
        continue
      }

      changed.push({ name: declaration.name, value, previous })
    }

    if (changed.length === 0) {
      return
    }

    const cascade = this.#derivedDependents(manifest, regionScope, changed.map((entry) => entry.name))
      .map((name) => ({ name, previous: this.#lastCounts.get(region)?.get(name) ?? null, value: this.#valueOf(name, regionScope) }))
      .filter((entry) => entry.value !== entry.previous)

    const cache: StateBucket = this.#lastCounts.get(region) ?? new Map()

    for (const entry of [...changed, ...cascade]) {
      cache.set(entry.name, entry.value)
    }

    this.#lastCounts.set(region, cache)

    for (const entry of [...changed, ...cascade]) {
      this.#writeValueSlots(manifest, regionScope, entry.name, entry.value)
    }

    const names = [...changed, ...cascade].map((entry) => entry.name)

    this.#writeConditionals(manifest, regionScope, names)
    this.#writePresence(manifest, regionScope, names)

    for (const entry of [...changed, ...cascade]) {
      this.#announceState(regionScope, entry.name, entry.value, entry.previous)
    }
  }

  #recountQueued = new Set<Region>()

  itemRekeyed(slot: Slot, key: string, previousKey: string): void {
    const region = this.#slots.regionOf(slot)

    if (!region) {
      return
    }

    for (const store of [this.#scoped, this.#seeds]) {
      const buckets = store.get(region)
      const bucket = buckets?.get(previousKey)

      if (!buckets || !bucket) {
        continue
      }

      buckets.delete(previousKey)
      buckets.set(key, bucket)
    }
  }

  #settleBranch(slot: Slot): void {
    const region = this.#slots.regionOf(slot)

    if (!region) {
      return
    }

    const manifest = this.manifestFor(region)

    if (!manifest) {
      return
    }

    const element = hostOf(slot.anchor)

    if (!element) {
      return
    }

    for (const [name, reads] of Object.entries(manifest.reads)) {
      if (reads.length === 0) {
        continue
      }

      const scope = this.scopeFor(element, name)

      if (!scope) {
        continue
      }

      const value = this.getState(name, { scope })

      if (value === undefined) {
        continue
      }

      this.#writeValueSlots(manifest, scope, name, value)
    }

    const at = this.scopeFor(element)

    if (!at) {
      return
    }

    const declared = manifest.declarations.map((declaration) => declaration.name)

    this.#writePresence(manifest, at, declared)
    this.#writeConditionals(manifest, at, declared)
  }

  #settleItem(collection: Slot, item: Item): void {
    const region = this.#slots.regionOf(collection)

    if (!region) {
      return
    }

    const manifest = this.manifestFor(region)

    if (!manifest) {
      return
    }

    const at = scopeOf(region, item)

    for (const [name, indices] of Object.entries(manifest.reads)) {
      const scope = this.scopeFor(at, name) ?? at
      const value = this.getState(name, { scope })

      if (value === undefined) {
        continue
      }

      const text = printValue(value)

      for (const index of indices) {
        const slot = item.slots.get(index)

        if (!slot || slot.type === "boolean_attribute") {
          continue
        }

        this.#write(slot, text)
        this.#slots.claim(slot)
      }
    }

    for (const [indexKey, entry] of Object.entries(manifest.presence ?? {})) {
      const slot = item.slots.get(Number(indexKey))

      if (!slot) {
        continue
      }

      this.#slots.setBooleanAttribute(slot, matches(entry, (name) => this.#valueOf(name, at)))
      this.#slots.claim(slot)
    }
  }

  attributeWritten(slot: Slot): void {
    const element = elementOf(slot.anchor)

    if (!element || slot.attribute !== "value") {
      return
    }

    if (!VALUE_ELEMENTS.includes(element.localName)) {
      return
    }

    const written = element.getAttribute("value") ?? ""

    if ((element as HTMLInputElement).value !== written) {
      ;(element as HTMLInputElement).value = written
    }
  }
}
