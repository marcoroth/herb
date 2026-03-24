import type { SerializedNode } from "./nodes/index.js"

export interface DiffOperation {
  type: string
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
