import { Visitor, findParentArray, createLiteral, isHTMLTextNode, isLiteralNode, isERBNode } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"

const TAG_BODY_PROPERTIES = ["statements", "body"]

export function erbTagContent(node: Node): string {
  return ((node as unknown as { content?: { value?: string } }).content?.value) ?? ""
}

export function endsInLineComment(content: string): boolean {
  const line = content.slice(content.lastIndexOf("\n") + 1)

  let quote: string | null = null

  for (let index = 0; index < line.length; index++) {
    const character = line[index]

    if (quote) {
      if (character === "\\") {
        index++
      } else if (character === quote) {
        quote = null
      }

      continue
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character
    } else if (character === "#") {
      return true
    }
  }

  return false
}

class TrailingCommentCollector extends Visitor {
  readonly nodes: Node[] = []

  visitChildNodes(node: Node): void {
    for (const child of node.compactChildNodes()) {
      if (isERBNode(child) && endsInLineComment(erbTagContent(child))) {
        this.nodes.push(child)
      }

      child.accept(this)
    }
  }
}

function startsOnANewLine(node: Node | undefined): boolean {
  if (!node) return false
  if (isHTMLTextNode(node) || isLiteralNode(node)) return node.content.startsWith("\n")

  return false
}

export function separateTrailingComments(root: Node): void {
  const collector = new TrailingCommentCollector()

  root.accept(collector)

  for (const node of collector.nodes) {
    const record = node as unknown as Record<string, unknown>
    const tagBody = TAG_BODY_PROPERTIES.map(property => record[property]).find(value => Array.isArray(value)) as Node[] | undefined

    if (tagBody) {
      if (!startsOnANewLine(tagBody[0])) tagBody.unshift(createLiteral("\n"))
      continue
    }

    const parent = findParentArray(root, node)

    if (!parent) continue

    const next = parent.array[parent.index + 1]

    if (startsOnANewLine(next)) continue

    parent.array.splice(parent.index + 1, 0, createLiteral("\n"))
  }
}
