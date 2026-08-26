import { STATE_EVENT } from "../shared/events"
import { DEPENDENCIES_SELECTOR } from "../grammar/attributes"

import { Seeds } from "./seeds"
import { Counts } from "./counts"
import { ServerState } from "./server"
import { BoundInputs } from "./bound-inputs"
import { ElementObserver } from "../shared/element-observer"

import { report } from "../shared/report"
import { printValue } from "./values"
import { elementOf, hostOf } from "../markup/anchors"
import { armOf, matches, mentions } from "./conditions"
import { collectionIn, scopeOf, scoped } from "./scopes"
import { declarationSpot, declared, declaredValue } from "./declarations"

import type { Slots } from "../slots/slots"
import type { Conditional } from "./types"
import type { StateKind, StateValue } from "./values"
import type { Built, Item, Region, Slot } from "../types"
import type { CountOptions, DeclaredState, DependencyMap, PlacedSlot, ResolvedStateOptions, ScopeStore, ScopedSetOptions, SerializedState, StateChange, StateChangeDetail, StateListener, StateManifest, StateOptions, StateReport, StateScope, StateSlot, StateSnapshot, StateValues } from "./types"

import type { SlotsDelegate } from "../types"
import type { SeedsDelegate } from "./seeds"
import type { CountsDelegate } from "./counts"
import type { BoundInputsDelegate } from "./bound-inputs"
import type { ElementObserverDelegate } from "../shared/element-observer"

export class State implements ElementObserverDelegate, SlotsDelegate, SeedsDelegate, BoundInputsDelegate, CountsDelegate {
  private readonly slots: Slots
  private readonly server: ServerState
  private readonly declared = new Map<string, StateManifest>()
  private readonly scoped: ScopeStore = new Map()
  private readonly seeds: Seeds
  private readonly counts: Counts
  private readonly bound = new BoundInputs(this)
  private readonly options: ResolvedStateOptions

  private elements: ElementObserver | null = null
  private unobserveElements: (() => void) | null = null
  private unsubscribe: (() => void) | null = null

  constructor(slots: Slots, options: StateOptions = {}) {
    this.options = {
      transport: options.transport ?? ((request, signal) => this.server.fetch(request, signal)),
      debounce: options.debounce ?? 0,
      format: options.format ?? "slots",
    }

    this.slots = slots
    this.seeds = new Seeds(this, slots)
    this.counts = new Counts(this, slots)
    this.server = new ServerState(slots, this.options)
    this.unsubscribe = slots.subscribe(this)
  }

  set(key: string | SerializedState, value?: string): Promise<StateReport> {
    return this.server.set(key, value)
  }

  built(built: Built): void {
    this.settle(built)
  }

  itemAdded(slot: Slot): void {
    this.counts.itemsChanged(slot)
  }

  itemRemoved(slot: Slot): void {
    this.counts.itemsChanged(slot)
  }

  get(key: string): string | undefined {
    return this.server.get(key)
  }

  all(): SerializedState {
    return this.server.all()
  }

  names(): string[] {
    return this.server.names()
  }

  slotsFor(key: string): StateSlot[] {
    return this.server.slotsFor(key)
  }

  settle(built: Built): void {
    for (const slot of built.branches) {
      this.settleBranch(slot)
    }

    for (const { slot, item } of built.items) {
      this.settleItem(slot, item)
    }
  }

  adopt(root: ParentNode = document): number {
    const templates = [...root.querySelectorAll<HTMLTemplateElement>(DEPENDENCIES_SELECTOR)]

    for (const template of templates) {
      this.merge(template.content.textContent ?? template.textContent ?? "")
      template.remove()
    }

    return templates.length
  }

  observe(root: Node = document.documentElement, elements?: ElementObserver): void {
    if (typeof document === "undefined") {
      return
    }

    this.unsubscribe ??= this.slots.subscribe(this)

    this.bound.observe()

    this.unobserveElements?.()

    this.elements = elements ?? new ElementObserver()
    this.unobserveElements = this.elements.add(this)

    this.elements.observe(root)
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
    this.unobserveElements?.()
    this.unobserveElements = null
    this.elements = null

    this.unsubscribe?.()
    this.unsubscribe = null

    if (typeof document === "undefined") {
      return
    }

    this.bound.disconnect()
  }

  private write(slot: Slot, value: string): boolean {
    if (elementOf(slot.anchor) && slot.attribute) {
      return this.slots.setAttribute(slot, value)
    }

    return this.slots.setText(slot, value)
  }

  private merge(json: string): void {
    if (!json.trim()) {
      return
    }

    let map: DependencyMap

    try {
      map = JSON.parse(json) as DependencyMap
    } catch {
      return
    }

    this.server.adopt(map)

    for (const [file, manifest] of Object.entries(map.states ?? {})) {
      this.declared.set(file, manifest)
    }
  }

  manifestFor(region: Region): StateManifest | null {
    const manifest = this.slots.statesFor(region.file, region.version) ?? this.declared.get(region.file)

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

    const placed = new Map(this.slots.placements(target).map((placement) => [placement.region, placement]))

    for (const region of this.slots.regions()) {
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
    const resolved = this.scope(options.scope, name)
    if (!resolved) {
      return null
    }

    return this.valueAt(name, resolved)
  }

  setState(values: StateValues, options: ScopedSetOptions = {}): boolean {
    const names = Object.keys(values)
    if (names.length === 0) {
      return false
    }

    const resolved = this.scope(options.scope, names[0])

    if (!resolved) {
      this.reportUnknown(names[0], null)

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
      const declaration = this.declaration(manifest, target, name)

      if (declaration === null) {
        this.reportUnknown(name, resolved)

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
      previous.set(name, this.valueAt(name, target))
    }

    const dependents = new Map<StateScope, StateSnapshot[]>()

    for (const [scope, grouped] of groups) {
      dependents.set(scope, this.derivedDependents(manifest, scope, grouped).map((name) => ({ name, previous: this.valueAt(name, scope) })))
    }

    const regionScope = scopeOf(resolved.region)
    const counted = this.counts.declarationsIn(manifest).map((declaration) => ({ name: declaration.name, previous: this.valueAt(declaration.name, regionScope) }))
    const countDependents = this.derivedDependents(manifest, regionScope, counted.map((entry) => entry.name)).map((name) => ({ name, previous: this.valueAt(name, regionScope) }))

    for (const [name, value] of Object.entries(values)) {
      const target = scopes.get(name) ?? resolved

      this.store(target, name, value)
      this.writeValueSlots(manifest, target, name, value)
    }

    for (const [scope, grouped] of groups) {
      const recomputed: string[] = []

      for (const dependent of dependents.get(scope) ?? []) {
        const value = this.valueAt(dependent.name, scope)

        if (value === dependent.previous) {
          continue
        }

        recomputed.push(dependent.name)
        this.writeValueSlots(manifest, scope, dependent.name, value)
      }

      const changed = [...grouped, ...recomputed]

      this.writeConditionals(manifest, scope, changed)
      this.writePresence(manifest, scope, changed)
    }

    const recounted: string[] = []

    for (const entry of [...counted, ...countDependents]) {
      const value = this.valueAt(entry.name, regionScope)

      if (value === entry.previous) {
        continue
      }

      recounted.push(entry.name)
      this.writeValueSlots(manifest, regionScope, entry.name, value)
    }

    if (recounted.length > 0) {
      this.writeConditionals(manifest, regionScope, recounted)
      this.writePresence(manifest, regionScope, recounted)
    }

    for (const [name, value] of Object.entries(values)) {
      this.announceState(scopes.get(name) ?? resolved, name, value, previous.get(name) ?? null)
    }

    for (const [scope, list] of dependents) {
      for (const dependent of list) {
        const value = this.valueAt(dependent.name, scope)

        if (value !== dependent.previous) {
          this.announceState(scope, dependent.name, value, dependent.previous)
        }
      }
    }

    for (const entry of [...counted, ...countDependents]) {
      const value = this.valueAt(entry.name, regionScope)

      if (value !== entry.previous) {
        this.announceState(regionScope, entry.name, value, entry.previous)
      }
    }

    return true
  }

  toggle(name: string, options: ScopedSetOptions = {}): boolean {
    this.requireKind(name, options, "boolean", "toggle")

    const current = this.getState(name, options)

    return this.setState({ [name]: current !== true }, options)
  }

  increment(name: string, options: CountOptions = {}): boolean {
    this.requireKind(name, options, "integer", "increment")

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
    const resolved = this.scope(options.scope, name)
    if (!resolved) {
      return false
    }

    const seeded = this.seeds.held(resolved, name)

    return this.setState({ [name]: seeded ?? this.defaultOf(name, resolved) }, options)
  }

  on(name: string, listener: StateListener, options: ScopedSetOptions = {}): () => void {
    let scope: StateScope | null = null

    if (options.scope) {
      scope = this.scope(options.scope, name)
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

  private reportUnknown(name: string, scope: StateScope | null): void {
    let known: string[] = []

    if (scope) {
      known = this.declaredStates(scope).map((declaration) => declaration.name)
    }

    let listed = "no scope on this page declares it"

    if (known.length > 0) {
      listed = `the states in scope are ${known.join(", ")}`
    }

    report({
      template: scope?.region.file ?? this.slots.regions()[0]?.file ?? "",
      message: `nothing here declares the state \`${name}\`; ${listed}`,
      code: "herb-unknown-state",
      severity: "error",
      value: name,
    })
  }

  private scope(scope: StateScope | Element | undefined, name: string): StateScope | null {
    if (scope) {
      return this.scopeFor(scope, name)
    }

    for (const region of this.slots.regions()) {
      const manifest = this.manifestFor(region)

      if (manifest && declared(manifest, name, null) !== null) {
        return scopeOf(region)
      }
    }

    for (const region of this.slots.regions()) {
      if (this.declared.has(region.file) && !this.manifestFor(region)) {
        return scopeOf(region)
      }
    }

    return null
  }

  declarationFor(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null {
    return this.declaration(manifest, scope, name)
  }

  private declaration(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null {
    const collection = collectionIn(scope)

    return declared(manifest, name, collection)
  }

  private requireKind(name: string, options: ScopedSetOptions, kind: StateKind, operation: string): void {
    const resolved = this.scope(options.scope, name)

    if (!resolved) {
      return
    }

    const declaration = this.declarationIn(resolved, name)

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

  valueAt(name: string, at: StateScope): StateValue {
    const scope = this.scopeFor(at, name) ?? at
    const declaration = this.declarationIn(scope, name)

    if (declaration?.count) {
      return this.counts.countFor(declaration, scope)
    }

    if (declaration?.derived) {
      return this.deriveValue(declaration, scope)
    }

    const stored = this.scoped.get(scope.region)?.get(scope.item?.key ?? "")?.get(name)

    if (stored !== undefined) {
      return stored
    }

    const seeded = this.seeds.valueFor(name, scope)

    if (seeded !== undefined) {
      return seeded
    }

    return this.defaultOf(name, scope)
  }

  private deriveValue(declaration: DeclaredState, scope: StateScope): StateValue {
    const entry = declaration.derived

    if (entry === undefined || entry === null) {
      return null
    }

    if (declaration.kind !== "boolean" && Array.isArray(entry) && entry.length === 2 && entry[1] === null) {
      return this.valueAt(entry[0], scope)
    }

    return matches(entry, (name) => this.valueAt(name, scope))
  }

  derivedDependents(manifest: StateManifest, scope: StateScope, written: string[]): string[] {
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

  private defaultOf(name: string, scope: StateScope): StateValue {
    const declaration = this.declarationIn(scope, name)

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
    return this.declarationIn(this.scopeFor(scope, name) ?? scope, name) !== null
  }

  private declarationIn(scope: StateScope, name: string): DeclaredState | null {
    const manifest = this.manifestFor(scope.region)

    if (!manifest) {
      return null
    }

    return this.declaration(manifest, scope, name)
  }

  private store(scope: StateScope, name: string, value: StateValue): void {
    this.seeds.valueFor(name, scope)

    scoped(this.scoped, scope).set(name, value)
  }

  private writeValueSlots(manifest: StateManifest, scope: StateScope, name: string, value: StateValue): void {
    const text = printValue(value)

    for (const index of manifest.reads[name] ?? []) {
      for (const slot of this.scopedSlots(scope, index)) {
        if (slot.type === "boolean_attribute") {
          continue
        }

        this.write(slot, text)
        this.slots.claim(slot)
      }
    }
  }

  private writePresence(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, entry] of Object.entries(manifest.presence ?? {})) {
      if (!mentions(entry, changed)) {
        continue
      }

      for (const placed of this.placedSlots(scope, Number(indexKey))) {
        const present = matches(entry, (name) => this.valueAt(name, placed.scope))

        this.slots.setBooleanAttribute(placed.slot, present)
        this.slots.claim(placed.slot)
      }
    }
  }

  private writeConditionals(manifest: StateManifest, scope: StateScope, changed: string[]): void {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      if (!conditional.arms.some((arm) => mentions(armOf(arm).condition, changed))) {
        continue
      }

      for (const placed of this.placedSlots(scope, Number(indexKey))) {
        const slot = placed.slot
        const target = this.targetBranch(conditional, placed.scope)

        if (!this.slots.switchBranch(slot, target) && slot.branch !== target) {
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

  private targetBranch(conditional: Conditional, scope: StateScope): number | null {
    const valueOf = (name: string) => this.valueAt(name, scope)

    for (const entry of conditional.arms) {
      const arm = armOf(entry)

      if (matches(arm.condition, valueOf)) {
        return arm.branch
      }
    }

    return conditional.else
  }

  resetBound(form: HTMLFormElement): void {
    this.bound.resetForm(form)
  }

  attributeWritten(slot: Slot): void {
    this.bound.slotWritten(slot)
  }

  countsChanged(manifest: StateManifest, scope: StateScope, changes: StateChange[]): void {
    for (const entry of changes) {
      this.writeValueSlots(manifest, scope, entry.name, entry.value)
    }

    const names = changes.map((entry) => entry.name)

    this.writeConditionals(manifest, scope, names)
    this.writePresence(manifest, scope, names)

    for (const entry of changes) {
      this.announceState(scope, entry.name, entry.value, entry.previous)
    }
  }

  scopedSlots(scope: StateScope, index: number): Slot[] {
    return this.placedSlots(scope, index).map((placed) => placed.slot)
  }

  private placedSlots(scope: StateScope, index: number): PlacedSlot[] {
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

  private announceState(scope: StateScope, name: string, value: StateValue, previous: StateValue): void {
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

  itemRekeyed(slot: Slot, key: string, previousKey: string): void {
    const region = this.slots.regionOf(slot)

    if (!region) {
      return
    }

    const buckets = this.scoped.get(region)
    const bucket = buckets?.get(previousKey)

    if (buckets && bucket) {
      buckets.delete(previousKey)
      buckets.set(key, bucket)
    }

    this.seeds.migrate(region, previousKey, key)
  }

  private settleBranch(slot: Slot): void {
    const region = this.slots.regionOf(slot)

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

      this.writeValueSlots(manifest, scope, name, value)
    }

    const at = this.scopeFor(element)

    if (!at) {
      return
    }

    const declared = manifest.declarations.map((declaration) => declaration.name)

    this.writePresence(manifest, at, declared)
    this.writeConditionals(manifest, at, declared)
  }

  private settleItem(collection: Slot, item: Item): void {
    const region = this.slots.regionOf(collection)

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

        this.write(slot, text)
        this.slots.claim(slot)
      }
    }

    for (const [indexKey, entry] of Object.entries(manifest.presence ?? {})) {
      const slot = item.slots.get(Number(indexKey))

      if (!slot) {
        continue
      }

      this.slots.setBooleanAttribute(slot, matches(entry, (name) => this.valueAt(name, at)))
      this.slots.claim(slot)
    }
  }
}
