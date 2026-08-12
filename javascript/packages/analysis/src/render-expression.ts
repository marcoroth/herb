import { isPrismNodeType } from "@herb-tools/core"

import type { PrismNode } from "@herb-tools/core"

export interface RenderPartialExpression {
  node: PrismNode
  explicit: boolean
}

export function renderPartialExpression(call: PrismNode): RenderPartialExpression | null {
  if (!isPrismNodeType(call, "CallNode")) return null

  const args = call.arguments_?.arguments_ ?? []
  const [first] = args

  if (!first) return null

  const named = namedPartialArgument(args)

  if (named) return { node: named, explicit: true }

  if (isPrismNodeType(first, "KeywordHashNode")) return null

  return { node: first, explicit: false }
}

function namedPartialArgument(args: PrismNode[]): PrismNode | null {
  for (const argument of args) {
    if (!isPrismNodeType(argument, "KeywordHashNode")) continue

    for (const element of argument.elements ?? []) {
      if (!isPrismNodeType(element, "AssocNode")) continue
      if (!isPrismNodeType(element.key, "SymbolNode")) continue
      if (element.key.unescaped?.value !== "partial") continue

      return element.value
    }
  }

  return null
}
