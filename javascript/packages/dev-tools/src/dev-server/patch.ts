import type { DiffOperation, PatchMessage } from "./types"

export function applyPatch(message: PatchMessage): boolean {
  const selector = `[data-herb-debug-file-relative-path="${message.file}"]`
  const roots = document.querySelectorAll(selector)

  if (roots.length === 0) {
    console.debug("[herb-client] no roots found for selector:", selector)
    return false
  }

  let applied = false

  for (const operation of message.operations) {
    let operationApplied = false

    for (let i = 0; i < roots.length; i++) {
      if (applyOperation(roots[i], operation)) {
        operationApplied = true
      } else {
        console.debug(`[herb-client] operation not applied to root ${i}:`, roots[i])
      }
    }

    if (operationApplied) {
      applied = true
    } else {
      console.debug("[herb-client] operation not applied:", operation)
    }
  }

  return applied
}

function applyOperation(root: Element, operation: DiffOperation): boolean {
  switch (operation.type) {
    case "text_changed":
      return applyTextChange(root, operation)
    case "attribute_value_changed":
      return applyAttributeChange(root, operation)
    case "attribute_added":
      return applyAttributeAdd(root, operation)
    case "attribute_removed":
      return applyAttributeRemove(root, operation)
    default:
      console.debug(`[herb-client] unhandled operation type: ${operation.type}`)
      return false
  }
}

function parseAttribute(value: string): { name: string; value: string } | null {
  const match = value.match(/^([^=]+)="(.*)"$/)
  if (!match) return null

  return { name: match[1], value: match[2] }
}

function findTarget(root: Element, operation: DiffOperation): Element | null {
  if (!operation.old_value) return null

  const attribute = parseAttribute(operation.old_value)
  if (!attribute) return null

  if (root.getAttribute(attribute.name) === attribute.value) return root

  const target = root.querySelector(`[${attribute.name}="${CSS.escape(attribute.value)}"]`)

  return target as Element | null
}

function findTextTarget(root: Element, operation: DiffOperation): Text | null {
  if (operation.old_value === null) return null

  const trimmedOld = operation.old_value.trim()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let node: Text | null

  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.trim() === trimmedOld) {
      return node
    }
  }

  return null
}

function applyTextChange(root: Element, operation: DiffOperation): boolean {
  if (operation.new_value === null) return false

  const textNode = findTextTarget(root, operation)

  if (textNode) {
    textNode.textContent = operation.new_value

    return true
  }

  return false
}

function applyAttributeChange(root: Element, operation: DiffOperation): boolean {
  if (operation.old_value === null || operation.new_value === null) return false

  const node = findTarget(root, operation)
  if (!node) return false

  const newAttr = parseAttribute(operation.new_value)
  if (!newAttr) return false

  node.setAttribute(newAttr.name, newAttr.value)

  return true
}

function applyAttributeAdd(root: Element, operation: DiffOperation): boolean {
  if (operation.new_value === null) return false

  const attribute = parseAttribute(operation.new_value)
  if (!attribute) return false

  const node = findTarget(root, operation) ?? root

  node.setAttribute(attribute.name, attribute.value)

  return true
}

function applyAttributeRemove(root: Element, operation: DiffOperation): boolean {
  if (operation.old_value === null) return false

  const node = findTarget(root, operation)
  if (!node) return false

  const match = operation.old_value.match(/^([^=]+)(?:=".*")?$/)
  if (!match) return false

  node.removeAttribute(match[1])

  return true
}
