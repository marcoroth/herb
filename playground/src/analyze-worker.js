import { Herb } from "@herb-tools/browser"

import { analyze } from "./analyze"
import { toAnalyzePayload } from "./analyze-payload"

let loading = null

function ready() {
  loading ||= Herb.load()

  return loading
}

self.addEventListener("message", async (event) => {
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
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) })
  }
})
