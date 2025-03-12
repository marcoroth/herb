import { Location, SerializedLocation } from "./location.js"
import { HerbError, SerializedHerbError } from "./error.js"
import { NodeType, SerializedNodeType, fromSerializedNode } from "./nodes.js"

export interface SerializedNode {
  type: SerializedNodeType
  location: SerializedLocation
  errors: SerializedHerbError[]
}

export interface BaseNodeProps {
  type: NodeType
  location: Location
  errors: HerbError[]
}

export abstract class Node implements BaseNodeProps {
  readonly type: NodeType
  readonly location: Location
  readonly errors: HerbError[]

  static from(node: SerializedNode): Node {
    return fromSerializedNode(node)
  }

  constructor(type: NodeType, location: Location, errors: HerbError[]) {
    this.type = type
    this.location = location
    this.errors = errors
  }

  toJSON(): SerializedNode {
    return {
      type: this.type,
      location: this.location.toJSON(),
      errors: this.errors,
    }
  }

  inspect(): string {
    return this.treeInspect(0)
  }

  abstract treeInspect(indent?: number): string

  protected inspectArray(
    array: (Node | HerbError)[] | null | undefined,
    prefix: string,
  ): string {
    if (!array) return "∅\n"
    if (array.length === 0) return "[]\n"

    let output = `(${array.length} item${array.length == 1 ? "" : "s"})\n`

    array.forEach((item, index) => {
      const isLast = index === array.length - 1

      if (item instanceof Node || item instanceof HerbError) {
        output += this.inspectNode(
          item,
          prefix,
          isLast ? "    " : "│   ",
          isLast,
          false,
        )
      } else {
        const symbol = isLast ? "└── " : "├── "
        output += `${prefix}${symbol} ${item}\n`
      }
    })

    output += `${prefix}\n`

    return output
  }

  protected inspectNode(
    node: Node | HerbError | undefined | null,
    prefix: string,
    prefix2: string = "    ",
    last: boolean = true,
    trailingNewline: boolean = true,
  ): string {
    if (!node) return "∅\n"

    let output = trailingNewline ? "\n" : ""
    output += `${prefix}`

    output += last ? "└── " : "├── "
    output += node
      .treeInspect()
      .trimStart()
      .split("\n")
      .map((line, index) =>
        index == 0 ? line.trimStart() : `${prefix}${prefix2}${line}`,
      )
      .join("\n")
      .trimStart()

    output += `\n`

    return output
  }
}
