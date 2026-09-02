import { VALUE_ELEMENTS } from "./bindings"

import { bindable } from "./bindings"
import { bareRead } from "./conditions"
import { elementOf } from "../markup/anchors"
import { boundValue } from "./values"

import type { Slot } from "../types"
import type { BoundState, DeclaredState, ScopedSetOptions, StateManifest, StateScope, StateValues } from "./types"

export interface BoundInputsDelegate {
  manifestFor(region: Slot["region"]): StateManifest | null
  declarationFor(manifest: StateManifest, scope: StateScope, name: string): DeclaredState | null
  scopeFor(element: Element): StateScope | null
  scopedSlots(scope: StateScope, index: number): Slot[]
  setState(values: StateValues, options?: ScopedSetOptions): boolean
  reset(name: string, options?: ScopedSetOptions): boolean
}

export class BoundInputs {
  private delegate: BoundInputsDelegate

  constructor(delegate: BoundInputsDelegate) {
    this.delegate = delegate
  }

  observe(): void {
    document.addEventListener("input", this.onInput)
    document.addEventListener("change", this.onInput)
    document.addEventListener("reset", this.onReset)
  }

  disconnect(): void {
    document.removeEventListener("input", this.onInput)
    document.removeEventListener("change", this.onInput)
    document.removeEventListener("reset", this.onReset)
  }

  private onInput = (event: Event): void => {
    const element = event.target

    if (!(element instanceof Element)) {
      return
    }

    this.sync(element)
  }

  private onReset = (event: Event): void => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) {
      return
    }

    setTimeout(() => {
      for (const element of form.elements) {
        this.sync(element)
      }
    }, 0)
  }

  private sync(element: Element): void {
    const found = this.nameOf(element)

    if (!found) {
      return
    }

    const declaration = this.delegate.declarationFor(found.manifest, found.scope, found.name)
    const value = boundValue(element, declaration?.kind ?? "string")

    this.delegate.setState({ [found.name]: value }, { scope: found.scope })
  }

  resetForm(form: HTMLFormElement): void {
    for (const element of form.elements) {
      const found = this.nameOf(element)

      if (found) {
        this.delegate.reset(found.name, { scope: found.scope })
      }
    }
  }

  private nameOf(element: Element): BoundState | null {
    if (!VALUE_ELEMENTS.includes(element.localName)) {
      return null
    }

    const scope = this.delegate.scopeFor(element)
    if (!scope) {
      return null
    }

    const manifest = this.delegate.manifestFor(scope.region)
    if (!manifest) {
      return null
    }

    const shipped = manifest.bound

    for (const [name, indices] of Object.entries(shipped ?? manifest.reads ?? {})) {
      for (const index of indices) {
        for (const slot of this.delegate.scopedSlots(scope, index)) {
          if (elementOf(slot.anchor) !== element) {
            continue
          }

          if (!shipped && !bindable(slot)) {
            continue
          }

          if (!shipped && slot.type === "boolean_attribute" && bareRead(manifest.presence?.[String(index)]) !== name) {
            continue
          }

          return { name, scope, manifest }
        }
      }
    }

    return null
  }

  slotWritten(slot: Slot): void {
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
