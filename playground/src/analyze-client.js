import AnalyzeWorker from "./analyze-worker.js?worker"

export class AnalyzeClient {
  #worker = null
  #pending = new Map()
  #nextId = 0
  #latestSupersedableId = 0

  #ensureWorker() {
    if (this.#worker) return this.#worker

    this.#worker = new AnalyzeWorker()

    this.#worker.addEventListener("message", (event) => {
      const { id, ok, payload, error } = event.data
      const request = this.#pending.get(id)

      if (!request) return

      this.#pending.delete(id)

      if (request.supersedable && id !== this.#latestSupersedableId) return request.resolve(null)
      if (ok) return request.resolve(payload)

      request.reject(new Error(error))
    })

    this.#worker.addEventListener("error", (event) => {
      const failure = new Error(event.message || "Analyze worker failed")

      for (const request of this.#pending.values()) request.reject(failure)

      this.#pending.clear()
    })

    return this.#worker
  }

  analyze(request) {
    return this.#send(request, false)
  }

  analyzeLatest(request) {
    return this.#send(request, true)
  }

  #send(request, supersedable) {
    const worker = this.#ensureWorker()
    const id = ++this.#nextId

    if (supersedable) this.#latestSupersedableId = id

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, supersedable })
      worker.postMessage({ id, ...request })
    })
  }

  dispose() {
    this.#worker?.terminate()
    this.#worker = null
    this.#pending.clear()
  }
}
