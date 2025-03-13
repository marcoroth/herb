import type { HerbBackend } from "@herb-tools/core"

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

  const string = await safeExecute(
    new Promise((resolve) => resolve(herb.parse(source).value.inspect())),
  )

  const json = await safeExecute(
    new Promise((resolve) =>
      resolve(JSON.stringify(herb.parse(source).value, null, 2)),
    ),
  )

  const lex = await safeExecute(
    new Promise((resolve) => resolve(herb.lex(source).value.inspect())),
  )

  const ruby = await safeExecute(
    new Promise((resolve) => resolve(herb.extractRuby(source))),
  )

  const html = await safeExecute(
    new Promise((resolve) => resolve(herb.extractHTML(source))),
  )

  const version = await safeExecute(
    new Promise((resolve) => resolve(herb.version)),
  )

  const endTime = performance.now()

  return {
    string,
    json,
    lex,
    ruby,
    html,
    version,
    duration: endTime - startTime,
  }
}
