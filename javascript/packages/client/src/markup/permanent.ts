import { HERB_ATTRIBUTES } from "../grammar/attributes"
import { currentHTML, hostOf, rangeOf } from "./anchors"

import type { SlotAnchor } from "../types"

export const PERMANENT_SELECTOR = `[${HERB_ATTRIBUTES.permanent}][id]`

export function withinPermanent(anchor: SlotAnchor): boolean {
  return Boolean(hostOf(anchor)?.closest(PERMANENT_SELECTOR))
}

function permanentElements(anchor: SlotAnchor): Map<string, Element> {
  const range = rangeOf(anchor)
  const elements = new Map<string, Element>()

  for (const element of hostOf(anchor)?.querySelectorAll(PERMANENT_SELECTOR) ?? []) {
    if (range.intersectsNode(element)) {
      elements.set(element.id, element)
    }
  }

  return elements
}

export function matchesAroundPermanent(anchor: SlotAnchor, html: string, normalize = (markup: string) => markup): boolean {
  const live = permanentElements(anchor)

  if (live.size === 0) {
    return false
  }

  const incoming = rangeOf(anchor).createContextualFragment(html)

  let current = currentHTML(anchor)

  for (const element of incoming.querySelectorAll(PERMANENT_SELECTOR)) {
    const kept = live.get(element.id)

    if (kept) {
      current = current.replace(kept.outerHTML, () => element.outerHTML)
    }
  }

  const holder = document.createElement("template")

  holder.content.append(incoming)

  return normalize(current) === normalize(holder.innerHTML)
}

export function keepPermanent(anchor: SlotAnchor, fragment: DocumentFragment): HTMLElement | null {
  const incoming = fragment.querySelectorAll(PERMANENT_SELECTOR)

  if (incoming.length === 0) {
    return null
  }

  const live = permanentElements(anchor)
  const active = document.activeElement

  let focused: HTMLElement | null = null

  for (const element of incoming) {
    const kept = live.get(element.id)

    if (!kept || !fragment.contains(element)) {
      continue
    }

    if (active instanceof HTMLElement && kept.contains(active)) {
      focused = active
    }

    element.replaceWith(kept)
  }

  return focused
}
