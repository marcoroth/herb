export interface RuntimeDiagnostic {
  template: string
  message: string
  code?: string
  severity?: "error" | "warning" | "info" | "hint"
  origin?: string
  location?: { start: { line: number; column: number } }
  suggestion?: string
  value?: string
}

interface DevToolsGlobal {
  report?(input: RuntimeDiagnostic | RuntimeDiagnostic[]): unknown
  clear?(origin?: string): void
}

export const RUNTIME_ORIGIN = "Herb Client Runtime"

const MAX_QUEUED = 50

const queued: RuntimeDiagnostic[] = []

export function report(diagnostic: RuntimeDiagnostic): void {
  const entry = { origin: RUNTIME_ORIGIN, ...diagnostic }
  const devTools = globalThis.window && (window as { HerbDevTools?: DevToolsGlobal }).HerbDevTools

  if (devTools?.report) {
    if (queued.length > 0) devTools.report(queued.splice(0))

    devTools.report(entry)

    return
  }

  if (!debugging()) return

  queued.push(entry)

  if (queued.length > MAX_QUEUED) queued.shift()
}

export function clearOnNavigation(): () => void {
  if (typeof document === "undefined") return () => {}

  const clear = (): void => {
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
