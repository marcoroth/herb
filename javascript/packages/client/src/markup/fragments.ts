import { asList } from "../shared/arrays"
import { branchKey, branchOf, slotOpenIndex } from "./markers"
import { anchoredSlots, closingFor, markers, slotOpeners } from "./anchors"

import { DEFAULT_SLOT_TYPE, PART_MARKER } from "./markers"
import { ANCHOR_ATTRIBUTE, NAME_ATTRIBUTE } from "./anchors"

import type { AnchorEntry, AttributeParts, FragmentMap, NameMap, PartsResolver, SlotValue, SlotValues } from "../types"

const HTML_ESCAPE_PATTERN = /[&<>"']/g
const HTML_ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|#39|#x27);/g

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
}

export function fillSlots(fragment: DocumentFragment, dynamics: SlotValues, text = false, parts?: PartsResolver): void {
  for (const open of slotOpeners(fragment)) {
    const index = slotOpenIndex(open.data.trim())

    if (index === null) {
      continue
    }

    const value = dynamics[index]

    if (value === undefined || Array.isArray(value)) {
      continue
    }

    const close = closingFor(open, index)

    if (!close) {
      continue
    }

    const range = document.createRange()

    range.setStartAfter(open)
    range.setEndBefore(close)
    range.deleteContents()
    range.insertNode(range.createContextualFragment(markup(value, text)))
  }

  for (const [element, entry] of anchoredSlots(fragment)) {
    const value = dynamics[entry.index]

    if (value === undefined) {
      continue
    }

    if (entry.attribute !== null) {
      const whole = wholeAttribute(entry, text ? value : attributeValue(value), parts)

      if (whole !== null) {
        element.setAttribute(entry.attribute, whole)
      }

      continue
    }

    if (entry.type === DEFAULT_SLOT_TYPE && !Array.isArray(value)) {
      element.innerHTML = markup(value, text)
    }
  }
}

export function blankSlots(fragment: DocumentFragment): void {
  for (const open of slotOpeners(fragment)) {
    if (!fragment.contains(open)) {
      continue
    }

    const index = slotOpenIndex(open.data.trim())

    if (index === null) {
      continue
    }

    const close = closingFor(open, index)

    if (!close) {
      continue
    }

    const range = document.createRange()

    range.setStartAfter(open)
    range.setEndBefore(close)
    range.deleteContents()
  }

  for (const [element, entry] of anchoredSlots(fragment)) {
    if (entry.attribute !== null) {
      if (entry.type === "boolean_attribute") {
        element.removeAttribute(entry.attribute)
      } else {
        element.setAttribute(entry.attribute, "")
      }

      continue
    }

    if (entry.type === DEFAULT_SLOT_TYPE) {
      element.replaceChildren()
    }
  }
}

export function attributeNames(template: DocumentFragment): NameMap {
  const names: NameMap = new Map()

  for (const [, entry] of anchoredSlots(template)) {
    if (entry.attribute !== null) {
      names.set(entry.attribute, entry.index)
    }
  }

  return names
}

export function parkedBranches(element: HTMLTemplateElement): FragmentMap {
  const branches: FragmentMap = new Map()

  let current: DocumentFragment | null = null

  for (const node of [...element.content.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const branch = branchOf((node as Comment).data.trim())

      if (branch) {
        current = document.createDocumentFragment()

        branches.set(branchKey(branch.index, branch.branch), current)
      }
    }

    current?.append(node)
  }

  return branches
}

export function attributeParts(fragment: DocumentFragment | null): AttributeParts | null {
  if (!fragment) {
    return null
  }

  const segments: AttributeParts = [""]

  for (const node of fragment.childNodes) {
    if (node.nodeType === Node.COMMENT_NODE) {
      if ((node as Comment).data.trim() === PART_MARKER) {
        segments.push("")
      }

      continue
    }

    segments[segments.length - 1] += node.textContent ?? ""
  }

  if (segments.length === 1) {
    return null
  }

  return segments
}

export function interpolateParts(parts: AttributeParts | null, value: SlotValue): string | null {
  if (!parts) {
    return null
  }

  const dynamics = asList(value)

  if (dynamics.length !== parts.length - 1) {
    return null
  }

  let whole = parts[0]

  for (let position = 1; position < parts.length; position += 1) {
    whole += `${dynamics[position - 1]}${parts[position]}`
  }

  return whole
}

export function escapeHTML(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPES[character])
}

export function unescapeHTML(value: string): string {
  if (!value.includes("&")) {
    return value
  }

  return value.replace(HTML_ENTITY_PATTERN, (_entity, name: string) => HTML_ENTITIES[name])
}

export function withoutMarkers(html: string): string {
  const holder = document.createElement("template")

  holder.innerHTML = html

  for (const marker of [...markers(holder.content)]) {
    if (marker.nodeType === Node.COMMENT_NODE) {
      (marker as Comment).remove()

      continue
    }

    const element = marker as Element

    element.removeAttribute(ANCHOR_ATTRIBUTE)
    element.removeAttribute(NAME_ATTRIBUTE)
  }

  return holder.innerHTML
}

export function attributeValue(value: SlotValue): SlotValue {
  if (Array.isArray(value)) {
    return value.map(unescapeHTML)
  }

  return unescapeHTML(value)
}

function wholeAttribute(entry: AnchorEntry, value: SlotValue, parts?: PartsResolver): string | null {
  if (entry.type === "attribute_interpolation") {
    return interpolateParts(parts?.(entry.index) ?? null, value)
  }

  if (Array.isArray(value)) {
    return null
  }

  return value
}

function markup(value: string, text: boolean): string {
  if (text) {
    return escapeHTML(value)
  }

  return value
}
