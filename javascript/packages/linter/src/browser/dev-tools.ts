import { ruleDocumentationUrl } from "../urls.js"

import type { Linter } from "../linter.js"
import type { DOMNodeLike } from "./dom-to-ast.js"
import type { LintOffense, LintResult, LintContext, LintSeverity } from "../types.js"

export const LINTER_ORIGIN = "Herb Linter (Rendered Page)"

export interface RuntimePosition {
  line: number
  column: number
}

export interface RuntimeRange {
  start: RuntimePosition
  end?: RuntimePosition
}

export interface RuntimeDiagnosticLike {
  template: string
  message: string
  code?: string
  severity?: LintSeverity
  origin?: string
  docsUrl?: string
  location?: RuntimeRange
  phase?: "compile" | "runtime"
  overlay?: false
  element?: DOMNodeLike
}

export interface DevToolsLike {
  report(input: RuntimeDiagnosticLike | RuntimeDiagnosticLike[]): { dismiss(): void }
  clear(origin?: string): void
  lintingEnabled?: boolean
}

interface WindowLike {
  HerbDevTools?: DevToolsLike
}

export const LINTER_TOGGLE_EVENT = "herb:dev-tools:linter"
const UNKNOWN_TEMPLATE = "(unknown template)"


function rangeOf(offense: LintOffense): RuntimeRange | undefined {
  if (!offense.location) return undefined

  const { start, end } = offense.location

  return { start: { line: start.line, column: start.column }, end: { line: end.line, column: end.column } }
}

export function toRuntimeDiagnostic(offense: LintOffense): RuntimeDiagnosticLike {
  return {
    template: offense.file?.path ?? UNKNOWN_TEMPLATE,
    message: offense.message,
    code: offense.rule,
    severity: offense.severity,
    origin: LINTER_ORIGIN,
    docsUrl: ruleDocumentationUrl(offense.rule),
    location: rangeOf(offense),
    phase: "runtime",
    overlay: false,
    element: offense.element,
  }
}

export function toRuntimeDiagnostics(result: LintResult): RuntimeDiagnosticLike[] {
  return result.offenses.map(toRuntimeDiagnostic)
}

export function devToolsIn(scope: unknown = globalThis): DevToolsLike | null {
  return (scope as WindowLike | undefined)?.HerbDevTools ?? null
}

export interface ReportOptions {
  root?: DOMNodeLike
  scope?: unknown
  context?: Partial<LintContext>
}

export function reportToDevTools(linter: Linter, options: ReportOptions = {}): { result: LintResult | null; handle: { dismiss(): void } | null } {
  const { root, scope, context } = options
  const target = root ?? (globalThis as { document?: { body?: DOMNodeLike } }).document?.body

  if (!target) {
    throw new Error("reportToDevTools needs a root to lint, and there is no document on this page")
  }

  const devTools = devToolsIn(scope)

  if (devTools?.lintingEnabled === false) {
    devTools.clear(LINTER_ORIGIN)

    return { result: null, handle: null }
  }

  const result = linter.lintElement(target, context)

  if (!devTools) {
    return { result, handle: null }
  }

  devTools.clear(LINTER_ORIGIN)

  return { result, handle: devTools.report(toRuntimeDiagnostics(result)) }
}
