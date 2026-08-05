import { deserializePrismNode } from "./index.js"

import type { PrismLocation } from "./index.js"
import type { PrismNode } from "./index.js"

function offsetToLineColumn(source: string, offset: number): string {
  let line = 1
  let column = 0

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++
      column = 0
    } else {
      column++
    }
  }

  return `${line}:${column}`
}

function formatLocation(location: PrismLocation, source: string): string {
  const start = offsetToLineColumn(source, location.startOffset)
  const end = offsetToLineColumn(source, location.startOffset + location.length)

  return `(${start})-(${end})`
}

function isPrismNode(value: any): boolean {
  return value && typeof value === "object" && typeof value.toJSON === "function" && value.location
}

export function inspectPrismNode(node: PrismNode, source: string, prefix: string = ""): string {
  if (!node) return "∅\n"

  const nodeName = typeof node.toJSON === "function" ? node.toJSON().type : node.constructor.name
  let output = ""

  output += `@ ${nodeName}`

  if (node.location) {
    output += ` (location: ${formatLocation(node.location, source)})`
  }

  output += "\n"

  const fields = getNodeFields(node)

  fields.forEach((field, index) => {
    const isLastField = index === fields.length - 1
    const symbol = isLastField ? "└── " : "├── "
    const childPrefix = prefix + (isLastField ? "    " : "│   ")
    const value = node[field]

    if (value === null || value === undefined) {
      output += `${prefix}${symbol}${field}: ∅\n`
    } else if (typeof value === "string") {
      output += `${prefix}${symbol}${field}: ${JSON.stringify(value)}\n`
    } else if (typeof value === "number" || typeof value === "boolean") {
      output += `${prefix}${symbol}${field}: ${value}\n`
    } else if (Array.isArray(value)) {
      output += `${prefix}${symbol}${field}: `

      if (value.length === 0) {
        output += "[]\n"
      } else {
        output += `(${value.length} item${value.length === 1 ? "" : "s"})\n`

        value.forEach((item: any, i: number) => {
          const isLastItem = i === value.length - 1
          const itemSymbol = isLastItem ? "└── " : "├── "
          const itemPrefix = childPrefix + (isLastItem ? "    " : "│   ")

          if (isPrismNode(item)) {
            output += `${childPrefix}${itemSymbol}${inspectPrismNode(item, source, itemPrefix).trimStart()}`
          } else {
            output += `${childPrefix}${itemSymbol}${item}\n`
          }
        })
      }
    } else if (isPrismNode(value)) {
      output += `${prefix}${symbol}${field}:\n`
      output += `${childPrefix}└── ${inspectPrismNode(value, source, childPrefix + "    ").trimStart()}`
    } else if (typeof value === "object" && value.startOffset !== undefined) {
      output += `${prefix}${symbol}${field}: (location: ${formatLocation(value, source)})\n`
    } else if (typeof value === "object" && "value" in value && "encoding" in value) {
      output += `${prefix}${symbol}${field}: ${JSON.stringify(value.value)}\n`
    } else {
      output += `${prefix}${symbol}${field}: ${String(value)}\n`
    }
  })

  return output
}

function getNodeFields(node: PrismNode): string[] {
  const skip = new Set(["nodeID", "location", "flags"])
  const fields: string[] = []

  for (const key of Object.keys(node)) {
    if (!skip.has(key)) {
      fields.push(key)
    }
  }

  return fields
}

export function inspectPrismSerialized(bytes: Uint8Array, source: string, prefix: string = ""): string {
  try {
    const node = deserializePrismNode(bytes, source)
    if (!node) return "∅"

    return "\n" + prefix + "└── " + inspectPrismNode(node, source, prefix + "    ").trimStart().trimEnd()
  } catch {
    return `(${bytes.length} bytes, deserialize error)`
  }
}
