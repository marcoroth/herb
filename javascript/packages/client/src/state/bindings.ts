import { elementOf } from "../markup/anchors"

import type { Slot } from "../types"

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
