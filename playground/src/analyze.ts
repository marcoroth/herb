import type { HerbBackend, ParseResult, LexResult, ParserOptions } from "@herb-tools/core"

import { FEATURES, UNSUPPORTED_NOTICE } from "./features"

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

export const DEFAULT_PRINT_OPTIONS = {}

export async function analyze(herb: HerbBackend, source: string, options: ParserOptions = {}, _printerOptions: any = DEFAULT_PRINT_OPTIONS, _formatterOptions: any = {}, _autofixOptions: AutofixOptions = {}) {
  const startTime = performance.now()

  const parseResult = await safeExecute<ParseResult>(
    new Promise((resolve) => resolve(herb.parse(source, options))),
  )

  const string = await safeExecute<string>(
    new Promise((resolve) => resolve(parseResult.value.inspect())),
  )

  const json = await safeExecute<string>(
    new Promise((resolve) =>
      resolve(JSON.stringify(parseResult.value, null, 2)),
    ),
  )

  const lexResult = await safeExecute<LexResult>(
    new Promise((resolve) => resolve(herb.lex(source))),
  )

  const lex = await safeExecute<string>(
    new Promise((resolve) => resolve(lexResult.value.inspect())),
  )

  const ruby = await safeExecute<string>(
    new Promise((resolve) => resolve(herb.extractRuby(source))),
  )

  const html = await safeExecute<string>(
    new Promise((resolve) => resolve(herb.extractHTML(source))),
  )

  const version = await safeExecute<string>(
    new Promise((resolve) => resolve(herb.version)),
  )

  const formatted = FEATURES.format ? "" : UNSUPPORTED_NOTICE
  const printed = FEATURES.printer ? "" : UNSUPPORTED_NOTICE
  const rewritten = FEATURES.rewrite ? "" : UNSUPPORTED_NOTICE

  const lintResult = null
  const autofixResult = null

  const endTime = performance.now()

  return {
    parseResult,
    lexResult,
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
