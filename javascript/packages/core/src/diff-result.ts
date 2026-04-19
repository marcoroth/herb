import type { SerializedNode } from "./nodes/index.js"

export type DiffOperationType =
  | "attribute_added"
  | "attribute_removed"
  | "attribute_value_changed"
  | "erb_content_changed"
  | "node_inserted"
  | "node_moved"
  | "node_removed"
  | "node_replaced"
  | "node_unwrapped"
  | "node_wrapped"
  | "tag_name_changed"
  | "text_changed"

export interface DiffOperation {
  type: DiffOperationType
  path: number[]
  oldNode: SerializedNode | null
  newNode: SerializedNode | null
  oldIndex: number
  newIndex: number
}

export interface DiffResult {
  identical: boolean
  operations: DiffOperation[]
}
