import { armOf } from "./conditions"
import { report } from "../shared/report"
import { scoped } from "./scopes"
import { elementOf } from "../markup/anchors"
import { coerceSeed, coerceState, kindArticle } from "./values"
import { comparandLiteral, declarationSpot, declaredValue } from "./declarations"

import type { Slots } from "../slots/slots"
import type { StateValue } from "./values"
import type { Region, Slot } from "../types"
import type { DeclaredState, ScopeStore, StateComparand, StateManifest, StateScope } from "./types"

export interface SeedsDelegate {
  manifestFor(region: Region): StateManifest | null
  declarationFor(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null
  scopedSlots(scope: StateScope, index: number): Slot[]
}

export class Seeds {
  private delegate: SeedsDelegate
  private slots: Slots
  private store: ScopeStore = new Map()
  private reported = new WeakMap<Region, Set<string>>()

  constructor(delegate: SeedsDelegate, slots: Slots) {
    this.delegate = delegate
    this.slots = slots
  }

  held(scope: StateScope, name: string): StateValue | undefined {
    return this.store.get(scope.region)?.get(scope.item?.key ?? "")?.get(name)
  }

  migrate(region: Region, from: string, to: string): void {
    const buckets = this.store.get(region)
    const bucket = buckets?.get(from)

    if (!buckets || !bucket) {
      return
    }

    buckets.delete(from)
    buckets.set(to, bucket)
  }

  valueFor(name: string, scope: StateScope): StateValue | undefined {
    const bucket = scoped(this.store, scope)

    if (bucket.has(name)) {
      return bucket.get(name)
    }

    const manifest = this.delegate.manifestFor(scope.region)
    if (!manifest) {
      return undefined
    }

    const value = this.firstOf(manifest, scope, name)

    if (value !== undefined) {
      bucket.set(name, value)
    }

    return value
  }

  private firstOf(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const shipped = this.shipped(manifest, scope, name)

    if (shipped !== undefined) {
      return shipped
    }

    const shown = this.fromValueSlot(manifest, scope, name)

    if (shown !== undefined) {
      return shown
    }

    const implied = this.fromConditional(manifest, scope, name)

    if (implied !== undefined) {
      return implied
    }

    return this.fromDeclaration(manifest, scope, name)
  }

  private fromDeclaration(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.delegate.declarationFor(manifest, scope, name)

    return declaration ? declaredValue(declaration) : undefined
  }

  private shipped(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.delegate.declarationFor(manifest, scope, name)

    if (!declaration || declaration.derived || declaration.count) {
      return undefined
    }

    const shipped = scope.item?.seeds?.[name] ?? scope.region.seeds?.[name]

    if (shipped === undefined) {
      this.warnUnshipped(scope, declaration, name)

      return undefined
    }

    return this.readShipped(scope, declaration, name, shipped)
  }

  private warnUnshipped(scope: StateScope, declaration: DeclaredState, name: string): void {
    const channel = scope.item?.seeds ?? scope.region.seeds

    if (!channel || declaredValue(declaration) !== undefined) {
      return
    }

    this.warn(scope, declaration, `the server shipped no value for \`${name}\`; its rendered value was not a boolean, number, string, or nil, so the client falls back to what the page shows`, "seed the state with a primitive, since that is all a state can hold")
  }

  private readShipped(scope: StateScope, declaration: DeclaredState, name: string, shipped: unknown): StateValue | undefined {
    const coerced = coerceSeed(shipped, declaration.kind)
    const article = kindArticle(declaration.kind)

    if (coerced === undefined) {
      this.warn(scope, declaration, `the server shipped ${JSON.stringify(shipped)} for \`${name}\`, which is declared as ${article}, and the client cannot read it as one`, `seed the state with ${article}`)

      return undefined
    }

    if (coerced !== shipped) {
      this.warn(scope, declaration, `the server shipped ${JSON.stringify(shipped)} for \`${name}\`, which is declared as ${article}, so the client coerced it to ${JSON.stringify(coerced)}`, `seed the state with ${article}`)
    }

    return coerced
  }

  private warn(scope: StateScope, declaration: DeclaredState, message: string, suggestion: string): void {
    const reported = this.reported.get(scope.region) ?? new Set<string>()
    const key = `${scope.item?.key ?? ""}:${declaration.name}`

    if (reported.has(key)) {
      return
    }

    reported.add(key)
    this.reported.set(scope.region, reported)

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

  private fromValueSlot(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.delegate.declarationFor(manifest, scope, name)

    for (const index of manifest.reads[name] ?? []) {
      for (const slot of this.delegate.scopedSlots(scope, index)) {
        const element = elementOf(slot.anchor)

        if (slot.type === "boolean_attribute") {
          const entry = manifest.presence?.[String(index)]

          if (!entry || !Array.isArray(entry) || entry[1] !== null || !element || !slot.attribute) {
            continue
          }

          return element.hasAttribute(slot.attribute)
        }

        return coerceState(this.slots.currentText(slot), declaration?.kind ?? "string")
      }
    }

    return undefined
  }

  private fromConditional(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    for (const [indexKey, conditional] of Object.entries(manifest.conditionals)) {
      const arms = conditional.arms.map((entry) => armOf(entry))

      if (!arms.some((arm) => Array.isArray(arm.condition) && arm.condition[0] === name)) {
        continue
      }

      for (const slot of this.delegate.scopedSlots(scope, Number(indexKey))) {
        const shown = arms.find((arm) => arm.branch === slot.branch)?.condition
        const condition = Array.isArray(shown) && shown[0] === name ? shown : null

        if (condition) {
          return condition[2] === undefined ? this.literalOf(condition[1]) : undefined
        }

        if (slot.branch === conditional.else || slot.branch === null) {
          return this.whenNoBranchShowsIt(manifest, scope, name)
        }
      }
    }

    return undefined
  }

  private whenNoBranchShowsIt(manifest: StateManifest, scope: StateScope, name: string): StateValue | undefined {
    const declaration = this.delegate.declarationFor(manifest, scope, name)

    return declaration?.kind === "boolean" ? false : undefined
  }

  private literalOf(comparand: StateComparand): StateValue | undefined {
    return comparand === null ? true : comparandLiteral(comparand)
  }
}
