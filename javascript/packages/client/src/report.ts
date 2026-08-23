export type DiagnosticSeverity = "error" | "warning" | "info" | "hint"

export interface DiagnosticPosition {
  line: number
  column: number
}

export interface DiagnosticLocation {
  start: DiagnosticPosition
}

export interface DiagnosticSpot {
  location?: DiagnosticLocation
}

// TODO: this should probably just import the type from the dev-tools or core
export interface RuntimeDiagnostic extends DiagnosticSpot {
  template: string
  message: string
  code?: string
  severity?: DiagnosticSeverity
  origin?: string
  suggestion?: string
  value?: string
  overlay?: "blocking" | "dismissible" | false
  element?: Element | null
}

interface DevToolsGlobal {
  report?(input: RuntimeDiagnostic | RuntimeDiagnostic[]): unknown
  clear?(origin?: string): void
}

export const RUNTIME_ORIGIN = "Herb Client Runtime"
export const DEV_TOOLS_START_EVENT = "herb:dev-tools-start"

const MAX_QUEUED = 50
const NAVIGATION_EVENT = "turbo:before-render"

const queued: RuntimeDiagnostic[] = []

let armed = false
let hooked = false

export function report(diagnostic: RuntimeDiagnostic): void {
  const entry = { origin: RUNTIME_ORIGIN, ...diagnostic }
  const devTools = currentDevTools()

  if (devTools?.report) {
    if (queued.length > 0) {
      devTools.report(queued.splice(0))
    }

    devTools.report(entry)

    return
  }

  if (debugging()) {
    let log = console.warn

    if (entry.severity === "error") {
      log = console.error
    }

    let suffix = ""

    if (entry.suggestion) {
      suffix = `. ${entry.suggestion}`
    }

    log(`[herb] ${entry.message}${suffix}`, entry)
  }

  queued.push(entry)

  if (queued.length > MAX_QUEUED) {
    queued.shift()
  }

  arm()
}

export function flushReports(): number {
  const devTools = currentDevTools()

  if (!devTools?.report || queued.length === 0) {
    return 0
  }

  const flushed = queued.splice(0)

  devTools.report(flushed)

  return flushed.length
}

export function resetReport(): void {
  queued.length = 0
  disarm()
}

function currentDevTools(): DevToolsGlobal | undefined {
  if (!globalThis.window) {
    return undefined
  }

  return (window as { HerbDevTools?: DevToolsGlobal }).HerbDevTools
}

function arm(): void {
  if (typeof document === "undefined") {
    return
  }

  hookGlobal()

  if (armed) {
    return
  }

  armed = true
  document.addEventListener(DEV_TOOLS_START_EVENT, onDevToolsReady)
  window.addEventListener("load", onDevToolsReady)
}

function disarm(): void {
  unhookGlobal()

  if (!armed) {
    return
  }

  armed = false
  document.removeEventListener(DEV_TOOLS_START_EVENT, onDevToolsReady)
  window.removeEventListener("load", onDevToolsReady)
}

function onDevToolsReady(): void {
  flushReports()
}

function hookGlobal(): void {
  if (typeof window === "undefined") {
    return
  }

  const descriptor = Object.getOwnPropertyDescriptor(window, "HerbDevTools")

  if (descriptor?.get) {
    return
  }

  if (descriptor && (descriptor.value !== undefined && descriptor.value !== null)) {
    return
  }

  if (descriptor && descriptor.configurable === false) {
    return
  }

  let current: DevToolsGlobal | undefined

  Object.defineProperty(window, "HerbDevTools", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: DevToolsGlobal | undefined) => {
      current = value

      if (value) {
        queueMicrotask(flushReports)
      }
    },
  })

  hooked = true
}

function unhookGlobal(): void {
  if (!hooked || typeof window === "undefined") {
    return
  }

  hooked = false

  const descriptor = Object.getOwnPropertyDescriptor(window, "HerbDevTools")

  if (descriptor?.get && descriptor.get() === undefined) {
    delete (window as { HerbDevTools?: unknown }).HerbDevTools
  }
}

export function clearOnNavigation(): () => void {
  if (typeof document === "undefined") {
    return () => {}
  }

  const clear = (): void => {
    queued.length = 0

    const devTools = globalThis.window && (window as { HerbDevTools?: DevToolsGlobal }).HerbDevTools

    devTools?.clear?.(RUNTIME_ORIGIN)
  }

  document.addEventListener(NAVIGATION_EVENT, clear)

  return () => document.removeEventListener(NAVIGATION_EVENT, clear)
}

function debugging(): boolean {
  if (typeof document === "undefined") {
    return false
  }

  return document.querySelector('meta[name="herb-debug-mode"][content="true"]') !== null
}
