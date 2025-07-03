import type { HerbBackend, ParseResult, LexResult } from "@herb-tools/core"
import { Linter } from "@herb-tools/linter"
import type { LintResult } from "@herb-tools/linter"

async function safeExecute<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error: any) {
    console.error(error)
    return error.toString()
  }
}

export async function analyze(herb: HerbBackend, source: string) {
  const startTime = performance.now()

  const parseResult = await safeExecute<ParseResult>(
    new Promise((resolve) => resolve(herb.parse(source))),
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

  let lintResult: LintResult | null = null

  if (parseResult && parseResult.value) {
    const linter = new Linter()

    lintResult = await safeExecute<LintResult>(
      new Promise((resolve) => resolve(linter.lint(parseResult.value))),
    )
  }

  const endTime = performance.now()

  return {
    parseResult,
    lexResult,
    string,
    json,
    lex,
    ruby,
    html,
    version,
    lintResult,
    duration: endTime - startTime,
  }
}
