export type ActionName = keyof typeof ACTION_SCHEMA
export type HerbAttribute = keyof typeof HERB_ATTRIBUTES

export interface ActionSchema {
  operation: "set" | "toggle" | "count" | "reset" | "action"
  needs?: "boolean" | "integer"
  step?: number
  bare?: boolean
}

export const HERB_ATTRIBUTES = {
  slot: "data-herb-slot",
  name: "data-herb-name",
  region: "data-herb-region",
  styleScoped: "data-herb-style-scoped",
  dependencies: "data-herb-dependencies",
  manifests: "data-herb-manifests",
  into: "data-herb-into",
  action: "data-herb-action",
  set: "data-herb-set",
  toggle: "data-herb-toggle",
  increment: "data-herb-increment",
  decrement: "data-herb-decrement",
  reset: "data-herb-reset",
  by: "data-herb-by",
  debounce: "data-herb-debounce",
  throttle: "data-herb-throttle",
} as const

export const ACTION_SCHEMA = {
  action: { operation: "action" },
  set: { operation: "set" },
  toggle: { operation: "toggle", needs: "boolean" },
  increment: { operation: "count", needs: "integer", step: 1 },
  decrement: { operation: "count", needs: "integer", step: -1 },
  reset: { operation: "reset", bare: true },
} as const satisfies Record<string, ActionSchema>

export const ACTION_NAMES = Object.keys(ACTION_SCHEMA) as ActionName[]
export const ACTION_SELECTOR = ACTION_NAMES.map((name) => `[${HERB_ATTRIBUTES[name]}]`).join(", ")
export const ACTION_ATTRIBUTES = ACTION_NAMES.map((name) => HERB_ATTRIBUTES[name])
export const DEPENDENCIES_ATTRIBUTE = HERB_ATTRIBUTES.dependencies
export const DEPENDENCIES_SELECTOR = `template[${DEPENDENCIES_ATTRIBUTE}]`
