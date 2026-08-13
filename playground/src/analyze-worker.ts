import { Herb } from "@herb-tools/browser"

import { analyze } from "./analyze"
import { toAnalyzePayload } from "./analyze-payload"

import type { AnalyzeRequest } from "./analyze-client"

let loading: Promise<unknown> | null = null

function ready() {
  loading ||= Herb.load()

  return loading
}

self.addEventListener("message", async (event: MessageEvent<AnalyzeRequest & { id: number }>) => {
  const { id, source, options, printerOptions, formatterOptions, autofixOptions, linterOptions, jobs } = event.data

  try {
    await ready()

    const result = await analyze(
      Herb,
      source,
      options,
      printerOptions,
      formatterOptions,
      autofixOptions,
      linterOptions,
      jobs,
    )

    self.postMessage({ id, ok: true, payload: toAnalyzePayload(result) })
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})
