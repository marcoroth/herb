import type { Herb } from "@herb-tools/core"

async function safeExecute<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    console.error(error)
    return error.toString()
  }
}

export async function analyze(herb: Herb, source: string) {
  const string = await safeExecute(
    herb.parse(source).then((result) => result.value.inspect()),
  )

  const json = await safeExecute(
    herb.parse(source).then((result) => JSON.stringify(result.value, null, 2)),
  )

  const lex = await safeExecute(
    herb.lex(source).then((result) => result.value.inspect()),
  )

  const ruby = await safeExecute(herb.extractRuby(source))
  const html = await safeExecute(herb.extractHtml(source))
  const version = await safeExecute(herb.version())

  return {
    string,
    json,
    lex,
    ruby,
    html,
    version,
  }
}
