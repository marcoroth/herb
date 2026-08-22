export interface RuntimeDiagnostic {
  template: string
  message: string
  code?: string
  severity?: "error" | "warning" | "info" | "hint"
  origin?: string
  location?: { start: { line: number; column: number } }
  suggestion?: string
  value?: string
  element?: Element | null
}

interface DevToolsGlobal {
  report?(input: RuntimeDiagnostic | RuntimeDiagnostic[]): unknown
  clear?(origin?: string): void
}

export const RUNTIME_ORIGIN = "Herb Client Runtime"
export const DEV_TOOLS_START_EVENT = "herb:dev-tools-start"

const MAX_QUEUED = 50

const queued: RuntimeDiagnostic[] = []

let armed = false
let hooked = false

export function report(diagnostic: RuntimeDiagnostic): void {
  const entry = { origin: RUNTIME_ORIGIN, ...diagnostic }
  const devTools = currentDevTools()

  if (devTools?.report) {
    if (queued.length > 0) devTools.report(queued.splice(0))

    devTools.report(entry)

    return
  }

  if (debugging()) {
    const log = entry.severity === "error" ? console.error : console.warn

    log(`[herb] ${entry.message}${entry.suggestion ? `. ${entry.suggestion}` : ""}`, entry)
  }

  queued.push(entry)

  if (queued.length > MAX_QUEUED) queued.shift()

  arm()
}

export function flushReports(): number {
  const devTools = currentDevTools()

  if (!devTools?.report || queued.length === 0) return 0

  const flushed = queued.splice(0)

  devTools.report(flushed)

  return flushed.length
}

export function resetReport(): void {
  queued.length = 0
  disarm()
}

function currentDevTools(): DevToolsGlobal | undefined {
  return globalThis.window ? (window as { HerbDevTools?: DevToolsGlobal }).HerbDevTools : undefined
}

function arm(): void {
  if (typeof document === "undefined") return

  hookGlobal()

  if (armed) return

  armed = true
  document.addEventListener(DEV_TOOLS_START_EVENT, onDevToolsReady)
  window.addEventListener("load", onDevToolsReady)
}

function disarm(): void {
  unhookGlobal()

  if (!armed) return

  armed = false
  document.removeEventListener(DEV_TOOLS_START_EVENT, onDevToolsReady)
  window.removeEventListener("load", onDevToolsReady)
}

function onDevToolsReady(): void {
  flushReports()
}

function hookGlobal(): void {
  if (typeof window === "undefined") return

  const descriptor = Object.getOwnPropertyDescriptor(window, "HerbDevTools")

  if (descriptor?.get) return
  if (descriptor && (descriptor.value !== undefined && descriptor.value !== null)) return
  if (descriptor && descriptor.configurable === false) return

  let current: DevToolsGlobal | undefined

  Object.defineProperty(window, "HerbDevTools", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: DevToolsGlobal | undefined) => {
      current = value

      if (value) queueMicrotask(flushReports)
    },
  })

  hooked = true
}

function unhookGlobal(): void {
  if (!hooked || typeof window === "undefined") return

  hooked = false

  const descriptor = Object.getOwnPropertyDescriptor(window, "HerbDevTools")

  if (descriptor?.get && descriptor.get() === undefined) delete (window as { HerbDevTools?: unknown }).HerbDevTools
}

export function clearOnNavigation(): () => void {
  if (typeof document === "undefined") return () => {}

  let landed = false

  const clear = (): void => {
    if (!landed) {
      landed = true

      return
    }

    queued.length = 0

    const devTools = globalThis.window && (window as { HerbDevTools?: DevToolsGlobal }).HerbDevTools

    devTools?.clear?.(RUNTIME_ORIGIN)
  }

  document.addEventListener("turbo:load", clear)

  return () => document.removeEventListener("turbo:load", clear)
}

function debugging(): boolean {
  if (typeof document === "undefined") return false

  return document.querySelector('meta[name="herb-debug-mode"][content="true"]') !== null
}
