import type { DiffOperation, PatchMessage } from "./types"

export function applyPatch(message: PatchMessage): boolean {
  const selector = `[data-herb-debug-file-relative-path="${message.file}"]`
  const elements = document.querySelectorAll(selector)

  if (elements.length === 0) {
    return false
  }

  for (const operation of message.operations) {
    applyOperation(elements, operation)
  }

  return true
}

function applyOperation(elements: NodeListOf<Element>, operation: DiffOperation): void {
  switch (operation.type) {
    case "text_changed":
      applyTextChange(elements, operation)
      break

    case "attribute_value_changed":
      applyAttributeChange(elements, operation)
      break

    case "attribute_added":
      applyAttributeAdd(elements, operation)
      break

    case "attribute_removed":
      applyAttributeRemove(elements, operation)
      break

    default:
      console.debug(`[herb-client] unhandled operation type: ${operation.type}`)
  }
}

function applyTextChange(elements: NodeListOf<Element>, operation: DiffOperation): void {
  if (operation.old_value === null || operation.new_value === null) return

  for (const element of elements) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Text | null

    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.trim() === operation.old_value!.trim()) {
        node.textContent = operation.new_value!
        return
      }
    }
  }
}

function applyAttributeChange(elements: NodeListOf<Element>, operation: DiffOperation): void {
  if (operation.old_value === null || operation.new_value === null) return

  const oldMatch = operation.old_value.match(/^([^=]+)="(.*)"$/)
  const newMatch = operation.new_value.match(/^([^=]+)="(.*)"$/)

  if (!oldMatch || !newMatch) return

  const attributeName = oldMatch[1]
  const oldAttributeValue = oldMatch[2]
  const newAttributeValue = newMatch[2]

  for (const element of elements) {
    const targets = element.querySelectorAll(`[${attributeName}="${oldAttributeValue}"]`)

    for (const target of targets) {
      target.setAttribute(attributeName, newAttributeValue)
    }

    if (element.getAttribute(attributeName) === oldAttributeValue) {
      element.setAttribute(attributeName, newAttributeValue)
    }
  }
}

function applyAttributeAdd(elements: NodeListOf<Element>, operation: DiffOperation): void {
  if (operation.new_value === null) return

  const match = operation.new_value.match(/^([^=]+)="(.*)"$/)
  if (!match) return

  const attributeName = match[1]
  const attributeValue = match[2]

  for (const element of elements) {
    element.setAttribute(attributeName, attributeValue)
  }
}

function applyAttributeRemove(elements: NodeListOf<Element>, operation: DiffOperation): void {
  if (operation.old_value === null) return

  const match = operation.old_value.match(/^([^=]+)(?:=".*")?$/)
  if (!match) return

  const attributeName = match[1]

  for (const element of elements) {
    element.removeAttribute(attributeName)
  }
}
