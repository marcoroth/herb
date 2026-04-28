import type { HerbBackend } from "@herb-tools/core"
import { inspectPrismNode } from "@herb-tools/core"

export async function analyzeRuby(herb: HerbBackend, source: string) {
  const startTime = performance.now()

  const parseResult = herb.parseRuby(source)
  const string = inspectPrismNode(parseResult.value, source)
  const version = herb.version

  const endTime = performance.now()

  return {
    string,
    version,
    duration: endTime - startTime,
  }
}
