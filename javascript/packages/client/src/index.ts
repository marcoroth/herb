export { Connection } from "./connection"
export { HerbClient } from "./client"
export { Toast } from "./toast"
export { MismatchAlert } from "./mismatch-alert"
export { ConnectionDot } from "./connection-dot"
export { applyPatch } from "./patch"

export type {
  ConnectionOptions,
  ConnectionState,
  HerbClientOptions,
  HerbMessage,
  WelcomeMessage,
  PatchMessage,
  RefreshMessage,
  ReloadMessage,
  ErrorMessage,
  FixedMessage,
  DiffOperation,
  ParseError,
} from "./types"

import { HerbClient } from "./client"
import type { HerbClientOptions } from "./types"

let instance: HerbClient | null = null

export function initHerbClient(options: HerbClientOptions = {}): HerbClient {
  if (instance) {
    instance.disconnect()
  }

  instance = new HerbClient(options)
  ;(window as any).__herbClient = instance
  instance.connect()

  return instance
}

export function getHerbClient(): HerbClient | null {
  return instance
}

function autoInitialize(): void {
  const debugMeta = document.querySelector('meta[name="herb-debug-mode"]')

  if (!debugMeta || debugMeta.getAttribute("content") !== "true") return

  initHerbClient()
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitialize)
  } else {
    autoInitialize()
  }
}
