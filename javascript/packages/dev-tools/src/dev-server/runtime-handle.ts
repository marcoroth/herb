import type { Runtime } from "@herb-tools/client"

type RuntimeHolder = { get?: () => unknown }

export function heldRuntime(): Runtime | null {
  if (typeof window === "undefined") {
    return null
  }

  const held = window.HerbRuntime as unknown

  if (isRuntime(held)) {
    return held
  }

  if (held && typeof (held as RuntimeHolder).get === "function") {
    const instance = (held as { get: () => unknown }).get()

    return isRuntime(instance) ? instance : null
  }

  return null
}

function isRuntime(value: unknown): value is Runtime {
  return Boolean(value) && typeof value === "object" && value !== null && "slots" in value
}
