import type { Slot } from "../types"

export function link(parent: Slot | null, child: Slot): void {
  if (!parent || parent === child) {
    return
  }

  child.parent = parent

  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

export function descendantsOf(slot: Slot): Slot[] {
  const found: Slot[] = []
  const queue = [...slot.children]

  while (queue.length > 0) {
    const next = queue.shift()!

    found.push(next)
    queue.push(...next.children)
  }

  return found
}

export function ancestorsOf(slot: Slot): Slot[] {
  const found: Slot[] = []

  let current = slot.parent

  while (current) {
    found.push(current)

    current = current.parent
  }

  return found
}
