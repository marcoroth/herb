export type ActionName = keyof typeof ACTION_SCHEMA
export type HerbAttribute = keyof typeof HERB_ATTRIBUTES

export interface ActionSchema {
  operation: "set" | "toggle" | "count" | "reset"
  needs?: "boolean" | "integer"
  step?: number
  bare?: boolean
}

export const HERB_ATTRIBUTES = {
  slot: "data-herb-slot",
  name: "data-herb-name",
  region: "data-herb-region",
  statics: "data-herb-statics",
  dependencies: "data-herb-dependencies",
  set: "data-herb-set",
  toggle: "data-herb-toggle",
  increment: "data-herb-increment",
  decrement: "data-herb-decrement",
  reset: "data-herb-reset",
  by: "data-herb-by",
} as const

export const ACTION_SCHEMA = {
  set: { operation: "set" },
  toggle: { operation: "toggle", needs: "boolean" },
  increment: { operation: "count", needs: "integer", step: 1 },
  decrement: { operation: "count", needs: "integer", step: -1 },
  reset: { operation: "reset", bare: true },
} as const satisfies Record<string, ActionSchema>

export const ACTION_NAMES = Object.keys(ACTION_SCHEMA) as ActionName[]
export const ACTION_SELECTOR = ACTION_NAMES.map((name) => `[${HERB_ATTRIBUTES[name]}]`).join(", ")
