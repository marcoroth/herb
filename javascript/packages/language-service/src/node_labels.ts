import { getAttributes, getAttributeName, getStaticAttributeValue, getTagName, getTokenList } from "@herb-tools/core"

import type { HTMLElementNode } from "@herb-tools/core"

export const UNNAMED_ELEMENT = "element"

export interface NodeLabelOptions {
  maximumClasses?: number
  excessClasses?: "truncate" | "drop"
  erbLabelLimit?: number
}

export const defaultNodeLabelOptions: Required<NodeLabelOptions> = {
  maximumClasses: 2,
  excessClasses: "truncate",
  erbLabelLimit: 32
}

export function elementClassNames(node: HTMLElementNode, options: NodeLabelOptions = {}): string[] {
  const maximumClasses = Math.max(0, options.maximumClasses ?? defaultNodeLabelOptions.maximumClasses)
  const excessClasses = options.excessClasses ?? defaultNodeLabelOptions.excessClasses

  const attribute = getAttributes(node).find(candidate => getAttributeName(candidate) === "class")
  if (!attribute) return []

  const classes = getTokenList(getStaticAttributeValue(attribute))

  if (classes.length <= maximumClasses) return classes

  return excessClasses === "drop" ? [] : classes.slice(0, maximumClasses)
}

export function elementSelector(node: HTMLElementNode, options: NodeLabelOptions = {}): string {
  const id = getStaticAttributeValue(node, "id")
  const classes = elementClassNames(node, options)

  return `${id ? `#${id}` : ""}${classes.map(name => `.${name}`).join("")}`
}

export function elementName(node: HTMLElementNode, options: NodeLabelOptions = {}): string {
  return `${getTagName(node) || UNNAMED_ELEMENT}${elementSelector(node, options)}`
}

export function erbLabel(content: string | null | undefined, options: NodeLabelOptions = {}): string {
  const limit = options.erbLabelLimit ?? defaultNodeLabelOptions.erbLabelLimit
  const collapsed = (content ?? "").replace(/\s+/g, " ").trim()

  return collapsed.length > limit ? `${collapsed.slice(0, limit).trimEnd()}…` : collapsed
}
