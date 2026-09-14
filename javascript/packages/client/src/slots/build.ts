import { fillSlots } from "../markup/fragments"

import type { PartsResolver, SlotValues } from "../types"

export interface SubtreeBuild {
  template: DocumentFragment
  target: Node
  values?: SlotValues
  text?: boolean
  resolve?: PartsResolver
  prepare?: (copy: DocumentFragment) => void
}

export function buildSubtree({ template, target, values = {}, text = false, resolve, prepare }: SubtreeBuild): Node[] {
  const copy = template.cloneNode(true) as DocumentFragment

  prepare?.(copy)

  fillSlots(copy, values, text, resolve)

  const added = [...copy.childNodes]

  target.parentNode?.insertBefore(copy, target)

  return added
}
