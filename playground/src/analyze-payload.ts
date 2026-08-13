import { toMonacoDiagnostic } from "@herb-tools/core"
import { rules, fixabilityFor } from "@herb-tools/linter"

import type { HerbError, MonacoDiagnostic, ParseResult } from "@herb-tools/core"
import type { AutofixResult, LintOffense, LintResult } from "@herb-tools/linter"
import type { analyze } from "./analyze"

export type AnalyzeResult = Awaited<ReturnType<typeof analyze>>

export type AnalyzeDiagnostic = MonacoDiagnostic & {
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
  highlighted?: string
  version?: string
  duration: number
  parserDiagnostics: AnalyzeDiagnostic[]
  hasParserErrors: boolean
  lintOffenses?: LintOffense[]
  hasUnsafeOffenses: boolean
  autofix?: { source: string | null, fixedCount: number } | null
}

function parserErrorsFor(parseResult: ParseResult | undefined): HerbError[] {
  if (!parseResult || typeof parseResult.recursiveErrors !== "function") return []

  return parseResult.recursiveErrors()
}

function offensesFor(lintResult: LintResult | null | undefined): LintOffense[] | undefined {
  if (!lintResult || !Array.isArray(lintResult.offenses)) return undefined

  return lintResult.offenses
}

function hasUnsafeOffenses(offenses: LintOffense[] | undefined): boolean {
  if (!offenses) return false

  return offenses.some(offense => {
    const rule = rules.find(candidate => candidate.ruleName === offense.rule)

    return fixabilityFor(offense, rule).unsafeAutocorrectable
  })
}

function autofixFor(autofixResult: AutofixResult | null | undefined): { source: string | null, fixedCount: number } | null | undefined {
  if (autofixResult === undefined) return undefined
  if (!autofixResult) return null

  return {
    source: typeof autofixResult.source === "string" ? autofixResult.source : null,
    fixedCount: Array.isArray(autofixResult.fixed) ? autofixResult.fixed.length : 0,
  }
}

export function toAnalyzePayload(result: AnalyzeResult): AnalyzePayload {
  const errors = parserErrorsFor(result.parseResult)
  const offenses = offensesFor(result.lintResult)

  const parserDiagnostics: AnalyzeDiagnostic[] = errors.map((error) => ({
    ...toMonacoDiagnostic(error),
    source: "Herb Parser",
    code: error.code || error.type || "parser-error",
  }))

  return {
    string: result.string,
    json: result.json,
    lex: result.lex,
    ruby: result.ruby,
    html: result.html,
    formatted: result.formatted,
    printed: result.printed,
    rewritten: result.rewritten,
    highlighted: result.highlighted,
    version: result.version,
    duration: result.duration,
    parserDiagnostics,
    hasParserErrors: errors.length > 0,
    lintOffenses: offenses,
    hasUnsafeOffenses: hasUnsafeOffenses(offenses),
    autofix: autofixFor(result.autofixResult),
  }
}
