import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import { slotsRequest, SlotsRequestError } from "../src/shared/slots-request"
import { armMutationRefresh } from "../src/shared/mutation-refresh"
import { resetReport } from "../src/shared/report"

import type { RuntimeDiagnostic } from "../src/shared/types"

const PAYLOAD = { template: "a.html.erb", version: "v1", occurrence: 0, slots: { 0: "x" } }

function respond(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), init)
}

let fetchMock: ReturnType<typeof vi.fn>
let reported: RuntimeDiagnostic[]

beforeEach(() => {
  reported = []
  fetchMock = vi.fn(async () => respond(PAYLOAD))

  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("HerbDevTools", { report: (input: RuntimeDiagnostic | RuntimeDiagnostic[]) => reported.push(...[input].flat()) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetReport()
  document.head.innerHTML = ""
})

describe("slotsRequest", () => {
  test("a server failure reports the error envelope and throws", async () => {
    fetchMock.mockResolvedValueOnce(respond({
      error: { class: "NoMethodError", message: "undefined method 'search'", template: "app/views/chat/show.html.erb", backtrace: ["app/views/chat/show.html.erb:56"] },
    }, { status: 500 }))

    const failed = slotsRequest("/chat")

    await expect(failed).rejects.toBeInstanceOf(SlotsRequestError)

    expect(reported).toHaveLength(1)
    expect(reported[0].code).toBe("NoMethodError")
    expect(reported[0].message).toBe("undefined method 'search'")
    expect(reported[0].template).toBe("app/views/chat/show.html.erb")
    expect(reported[0].backtrace).toEqual(["app/views/chat/show.html.erb:56"])
    expect(reported[0].overlay).toBe("dismissible")
  })

  test("a failure without an envelope still reports the status", async () => {
    fetchMock.mockResolvedValueOnce(respond(null, { status: 503 }))

    await expect(slotsRequest("/chat")).rejects.toBeInstanceOf(SlotsRequestError)

    expect(reported).toHaveLength(1)
    expect(reported[0].message).toBe("The application answered 503. Check the server log.")
  })

  test("report false leaves the overlay alone", async () => {
    fetchMock.mockResolvedValueOnce(respond(null, { status: 500 }))

    await expect(slotsRequest("/chat", { report: false })).rejects.toBeInstanceOf(SlotsRequestError)

    expect(reported).toHaveLength(0)
  })

  test("a mutation carries the page's CSRF token, a read does not", async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="tok123">'

    await slotsRequest("/chat/messages/1", { method: "PATCH", body: { body: "hi" } })
    await slotsRequest("/chat")

    const patchHeaders = fetchMock.mock.calls[0][1].headers
    const getHeaders = fetchMock.mock.calls[1][1].headers

    expect(patchHeaders["X-CSRF-Token"]).toBe("tok123")
    expect(getHeaders["X-CSRF-Token"]).toBeUndefined()
  })

  test("a plain object body goes out as JSON", async () => {
    await slotsRequest("/chat/messages/1", { method: "PATCH", body: { starred: true } })

    const [, init] = fetchMock.mock.calls[0]

    expect(init.body).toBe('{"starred":true}')
    expect(init.headers["Content-Type"]).toBe("application/json")
  })

  test("a 204 answer hands back an empty payload", async () => {
    fetchMock.mockResolvedValueOnce(respond(null, { status: 204 }))

    const payload = await slotsRequest("/chat/messages/1", { method: "DELETE" })

    expect(payload).toEqual({ template: "", version: "", occurrence: 0, slots: {} })
  })

  test("a settled mutation asks for a refresh, a read or a failure does not", async () => {
    const settled = vi.fn()
    const disarm = armMutationRefresh(settled)

    try {
      await slotsRequest("/chat")

      expect(settled).not.toHaveBeenCalled()

      await slotsRequest("/chat/messages/1", { method: "PATCH", body: { body: "hi" } })

      expect(settled).toHaveBeenCalledTimes(1)

      fetchMock.mockResolvedValueOnce(respond(null, { status: 500 }))

      await expect(slotsRequest("/chat/messages/1", { method: "PATCH", report: false })).rejects.toBeInstanceOf(SlotsRequestError)

      expect(settled).toHaveBeenCalledTimes(1)

      await slotsRequest("/chat/messages/1", { method: "PATCH", refresh: false })

      expect(settled).toHaveBeenCalledTimes(1)
    } finally {
      disarm()
    }
  })
})
