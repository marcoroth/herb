import AnalyzeWorker from "./analyze-worker.ts?worker"

import type { AnalyzePayload } from "./analyze-payload"
import type { AnalyzeJob, AutofixOptions, HighlighterOptions, LinterOptions } from "./analyze"
import type { ParserOptions } from "@herb-tools/core"
import type { PrintOptions } from "@herb-tools/printer"
import type { FormatOptions } from "@herb-tools/formatter"

export type AnalyzeRequest = {
  source: string
  options: ParserOptions
  printerOptions: PrintOptions
  formatterOptions: FormatOptions
  autofixOptions: AutofixOptions
  linterOptions: LinterOptions
  highlighterOptions: HighlighterOptions
  jobs: AnalyzeJob[]
}

type WorkerResponse = {
  id: number
  ok: boolean
  payload?: AnalyzePayload
  error?: string
}

type PendingRequest = {
  resolve: (payload: AnalyzePayload | null) => void
  reject: (error: Error) => void
  supersedable: boolean
}

export class AnalyzeClient {
  #worker: Worker | null = null
  #pending = new Map<number, PendingRequest>()
  #nextId = 0
  #latestSupersedableId = 0

  #ensureWorker(): Worker {
    if (this.#worker) return this.#worker

    const worker = new AnalyzeWorker()

    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const { id, ok, payload, error } = event.data
      const request = this.#pending.get(id)

      if (!request) return

      this.#pending.delete(id)

      if (request.supersedable && id !== this.#latestSupersedableId) return request.resolve(null)
      if (ok) return request.resolve(payload ?? null)

      request.reject(new Error(error))
    })

    worker.addEventListener("error", (event: ErrorEvent) => {
      const failure = new Error(event.message || "Analyze worker failed")

      for (const request of this.#pending.values()) request.reject(failure)

      this.#pending.clear()
    })

    this.#worker = worker

    return worker
  }

  analyze(request: AnalyzeRequest): Promise<AnalyzePayload | null> {
    return this.#send(request, false)
  }

  analyzeLatest(request: AnalyzeRequest): Promise<AnalyzePayload | null> {
    return this.#send(request, true)
  }

  #send(request: AnalyzeRequest, supersedable: boolean): Promise<AnalyzePayload | null> {
    const worker = this.#ensureWorker()
    const id = ++this.#nextId

    if (supersedable) this.#latestSupersedableId = id

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, supersedable })
      worker.postMessage({ id, ...request })
    })
  }

  dispose(): void {
    this.#worker?.terminate()
    this.#worker = null
    this.#pending.clear()
  }
}
