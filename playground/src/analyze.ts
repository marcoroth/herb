import type { HerbBackend, ParseResult, LexResult, ParserOptions } from "@herb-tools/core"

import { Formatter } from "@herb-tools/formatter"
import { Linter, ruleDocumentationUrl } from "@herb-tools/linter"
import { Highlighter } from "@herb-tools/highlighter"
import { IdentityPrinter, DEFAULT_PRINT_OPTIONS } from "@herb-tools/printer"
import { rewrite, ActionViewTagHelperToHTMLRewriter } from "@herb-tools/rewriter"

import type { LintResult, AutofixResult, Framework } from "@herb-tools/linter"
import type { FormatOptions } from "@herb-tools/formatter"
import type { PrintOptions } from "@herb-tools/printer"

async function safeExecute<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error: any) {
    console.error(error)
    return error.toString()
  }
}

export type AutofixOptions = {
  includeUnsafe?: boolean
}

export type LinterOptions = {
  framework?: Framework
}

export type AnalyzeJob =
  | "parse"
  | "full"
  | "lex"
  | "ruby"
  | "html"
  | "format"
  | "printer"
  | "rewrite"
  | "lint"
  | "autofix"

export const ALL_ANALYZE_JOBS: AnalyzeJob[] = [
  "parse",
  "full",
  "lex",
  "ruby",
  "html",
  "format",
  "printer",
  "rewrite",
  "lint",
  "autofix",
]

export type HighlighterOptions = {
  showDiagnostics?: boolean
  showLineNumbers?: boolean
  splitDiagnostics?: boolean
  focusLine?: number
  contextLines?: number
}

const HIGHLIGHTER_PATH = "template.html.erb"
const HIGHLIGHTER_CONTEXT_LINES = 2

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(herb: HerbBackend): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = (async () => {
      const highlighter = new Highlighter("onedark", herb)

      await highlighter.initialize()

      return highlighter
    })().catch((error) => {
      highlighterPromise = null

      throw error
    })
  }

  return highlighterPromise
}


async function renderHighlighter(herb: HerbBackend, source: string, lintResult: LintResult | null, highlighterOptions: HighlighterOptions): Promise<string> {
  const highlighter = await getHighlighter(herb)

  const showDiagnostics = highlighterOptions.showDiagnostics ?? true
  const diagnostics = showDiagnostics ? (lintResult?.offenses ?? []) : []

  return highlighter.highlight(HIGHLIGHTER_PATH, source, {
    diagnostics,
    splitDiagnostics: highlighterOptions.splitDiagnostics ?? true,
    showLineNumbers: highlighterOptions.showLineNumbers ?? true,
    contextLines: highlighterOptions.contextLines ?? HIGHLIGHTER_CONTEXT_LINES,
    focusLine: highlighterOptions.focusLine,
    wrapLines: false,
    codeUrlBuilder: ruleDocumentationUrl,
  })
}

export async function analyze(herb: HerbBackend, source: string, options: ParserOptions = {}, printerOptions: PrintOptions = DEFAULT_PRINT_OPTIONS, formatterOptions: FormatOptions = {}, autofixOptions: AutofixOptions = {}, linterOptions: LinterOptions = {}, highlighterOptions: HighlighterOptions = {}, jobs: Iterable<AnalyzeJob> = ALL_ANALYZE_JOBS) {
  const startTime = performance.now()
  const requested = new Set(jobs)
  const wants = (job: AnalyzeJob) => requested.has(job)

  const parseResult = await safeExecute<ParseResult>(
    new Promise((resolve) => resolve(herb.parse(source, options))),
  )

  const parsed = parseResult && parseResult.value

  const string = wants("parse")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve(parseResult.value.inspect())),
      )
    : undefined

  const json = wants("full")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve(JSON.stringify(parseResult.value, null, 2))),
      )
    : undefined

  const lexResult = wants("lex")
    ? await safeExecute<LexResult>(
        new Promise((resolve) => resolve(herb.lex(source))),
      )
    : undefined

  const lex = wants("lex")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve(lexResult!.value.inspect())),
      )
    : undefined

  const ruby = wants("ruby")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve(herb.extractRuby(source))),
      )
    : undefined

  const html = wants("html")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve(herb.extractHTML(source))),
      )
    : undefined

  const version = await safeExecute<string>(
    new Promise((resolve) => resolve(herb.version)),
  )

  const formatted = wants("format")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve((new Formatter(herb, formatterOptions)).format(source))),
      )
    : undefined

  const printed = wants("printer")
    ? await safeExecute<string>(
        new Promise((resolve) => resolve((new IdentityPrinter()).print(parseResult.value, printerOptions))),
      )
    : undefined

  let rewritten: string | null | undefined = undefined

  if (parsed && wants("rewrite")) {
    rewritten = await safeExecute<string>(
      new Promise((resolve) => {
        const rewriteParseResult = herb.parse(source, { ...options, track_whitespace: true })
        const rewriter = new ActionViewTagHelperToHTMLRewriter()
        const { output } = rewrite(rewriteParseResult.value, [rewriter], { baseDir: "/" })
        resolve(output)
      }),
    )
  }

  let lintResult: LintResult | null | undefined = undefined
  let autofixResult: AutofixResult | null | undefined = undefined

  if (parsed) {
    const lintContext = { framework: linterOptions.framework }

    if (wants("lint")) {
      lintResult = await safeExecute<LintResult>(
        new Promise((resolve) => resolve(new Linter(herb).lint(source, lintContext))),
      )
    }

    if (wants("autofix")) {
      try {
        autofixResult = new Linter(herb).autofix(source, lintContext, undefined, { includeUnsafe: autofixOptions.includeUnsafe === true })
      } catch (error) {
        console.error(error)

        autofixResult = null
      }
    }
  }

  const highlighted = await safeExecute<string>(renderHighlighter(herb, source, lintResult, highlighterOptions))

  const endTime = performance.now()

  return {
    parseResult,
    lexResult,
    highlighted,
    string,
    json,
    lex,
    ruby,
    html,
    formatted,
    printed,
    rewritten,
    version,
    lintResult,
    autofixResult,
    duration: endTime - startTime,
  }
}
