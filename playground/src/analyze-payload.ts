import { rules, fixabilityFor } from "@herb-tools/linter"

import type { ParseResult } from "@herb-tools/core"

export type AnalyzeDiagnostic = {
  severity: string
  message: string
  line: number
  column: number
  endLine: number
  endColumn: number
  source: string
  code: string
}

export type AnalyzePayload = {
  string?: string
  json?: string
  lex?: string
  ruby?: string
  html?: string
  formatted?: string
  printed?: string
  rewritten?: string | null
  version?: string
  duration: number
  parserDiagnostics: AnalyzeDiagnostic[]
  hasParserErrors: boolean
  lintOffenses?: any[]
  hasUnsafeOffenses: boolean
  autofix?: { source: string | null, fixedCount: number } | null
}

function parserErrorsFor(parseResult: ParseResult | undefined) {
  if (!parseResult || typeof (parseResult as any).recursiveErrors !== "function") return []

  return (parseResult as any).recursiveErrors()
}

function offensesFor(lintResult: any) {
  if (!lintResult || !Array.isArray(lintResult.offenses)) return undefined

  return lintResult.offenses
}

function hasUnsafeOffenses(offenses: any[] | undefined) {
  if (!offenses) return false

  return offenses.some(offense => {
    const rule = rules.find(candidate => candidate.ruleName === offense.rule)

    return fixabilityFor(offense, rule).unsafeAutocorrectable
  })
}

function autofixFor(autofixResult: any) {
  if (autofixResult === undefined) return undefined
  if (!autofixResult) return null

  return {
    source: typeof autofixResult.source === "string" ? autofixResult.source : null,
    fixedCount: Array.isArray(autofixResult.fixed) ? autofixResult.fixed.length : 0,
  }
}

/**
 * Flattens an analysis into structured-cloneable data.
 *
 * `parseResult` carries methods that do not survive `postMessage`, so the
 * errors it holds are resolved into diagnostics before the payload is sent.
 *
 * @param {Object} result
 * @returns {AnalyzePayload}
 */
export function toAnalyzePayload(result: any): AnalyzePayload {
  const errors = parserErrorsFor(result.parseResult)
  const offenses = offensesFor(result.lintResult)

  const parserDiagnostics = errors.map((error: any) => {
    const diagnostic = error.toMonacoDiagnostic()

    diagnostic.source = "Herb Parser"
    diagnostic.code = diagnostic.code || error.code || error.type || "parser-error"

    return diagnostic
  })

  return {
    string: result.string,
    json: result.json,
    lex: result.lex,
    ruby: result.ruby,
    html: result.html,
    formatted: result.formatted,
    printed: result.printed,
    rewritten: result.rewritten,
    version: result.version,
    duration: result.duration,
    parserDiagnostics,
    hasParserErrors: errors.length > 0,
    lintOffenses: offenses,
    hasUnsafeOffenses: hasUnsafeOffenses(offenses),
    autofix: autofixFor(result.autofixResult),
  }
}
