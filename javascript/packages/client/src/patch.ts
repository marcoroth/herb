import type { DiffOperation, PatchMessage } from "./types"

export function applyPatch(message: PatchMessage): boolean {
  const selector = `[data-herb-debug-file-relative-path="${message.file}"]`
  const roots = document.querySelectorAll(selector)

  if (roots.length === 0) {
    console.debug("[herb-client] no roots found for selector:", selector)
    return false
  }

  console.debug(`[herb-client] found ${roots.length} root(s) for ${message.file}, applying ${message.operations.length} operation(s)`)

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

function findTarget(root: Element, operation: DiffOperation): Element | null {
  if (!operation.old_value) return null

  const match = operation.old_value.match(/^([^=]+)="(.*)"$/)
  if (!match) return null

  const [, attributeName, attributeValue] = match

  if (root.getAttribute(attributeName) === attributeValue) return root

  const target = root.querySelector(`[${attributeName}="${CSS.escape(attributeValue)}"]`)

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
  if (!node || !(node instanceof Element)) return false

  const oldMatch = operation.old_value.match(/^([^=]+)="(.*)"$/)
  const newMatch = operation.new_value.match(/^([^=]+)="(.*)"$/)

  if (!oldMatch || !newMatch) return false

  const attributeName = oldMatch[1]
  const newAttributeValue = newMatch[2]

  node.setAttribute(attributeName, newAttributeValue)

  return true
}

function applyAttributeAdd(root: Element, operation: DiffOperation): boolean {
  if (operation.new_value === null) return false

  const node = findTarget(root, operation)
  if (!node || !(node instanceof Element)) return false

  const match = operation.new_value.match(/^([^=]+)="(.*)"$/)
  if (!match) return false

  node.setAttribute(match[1], match[2])

  return true
}

function applyAttributeRemove(root: Element, operation: DiffOperation): boolean {
  if (operation.old_value === null) return false

  const node = findTarget(root, operation)
  if (!node || !(node instanceof Element)) return false

  const match = operation.old_value.match(/^([^=]+)(?:=".*")?$/)
  if (!match) return false

  node.removeAttribute(match[1])

  return true
}
