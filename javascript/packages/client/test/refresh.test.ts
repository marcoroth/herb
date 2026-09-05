import { describe, test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"
import { mutationSettled } from "../src/shared/mutation-refresh"

import type { Payload } from "../src/types"

const FILE = "app/views/chat/show.html.erb"

function dependencies(states: Record<string, unknown>): string {
  return `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [FILE]: states } })}</template>`
}

const STATES = {
  version: "aaaaaaaa",
  declarations: [
    { name: "editing", kind: "boolean", default: "false", scope: "region" },
    { name: "q", kind: "string", default: '""', scope: "region" },
  ],
  reads: { q: [] },
  conditionals: { 0: { arms: [["editing", null, 0]], else: 1 } },
  presence: {},
  computed: {},
  server: {
    branches: { 0: [{ index: 2, node_path: [1, 0] }] },
    reads: { q: [{ index: 3, node_path: [2, 0] }] },
  },
}

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
  `<b><!--herb-slot:3--><!--/herb-slot:3--></b>` +
  `<template data-herb-region="${FILE}:aaaaaaaa">` +
  `<!--herb-branch:0:0--><em><!--herb-slot:2--><!--/herb-slot:2--></em>` +
  `<!--herb-branch:0:1--><p>off</p>` +
  `</template>` +
  `<!--/herb-region:${FILE}-->` +
  dependencies(STATES)

function payloadFor(slots: Payload["slots"]): Payload {
  return { template: FILE, version: "aaaaaaaa", occurrence: 0, slots }
}

let runtime: Runtime | null = null

function start(options: Parameters<typeof Runtime.start>[0] = {}): Runtime {
  runtime = Runtime.start(options)

  return runtime
}

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

describe("refetching server-derived slots", () => {
  test("materializing a branch with an empty server read refetches once, steered", async () => {
    document.body.innerHTML = PAGE

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return payloadFor({ 0: { branch: 0, slots: { 2: "served" } } })
    })

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ editing: true })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("served")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(calls[0][FILE].editing).toBe(true)
  })

  test("a branch whose values are remembered does not refetch", async () => {
    document.body.innerHTML = PAGE

    const transport = vi.fn(async () => payloadFor({}))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.slots.apply(payloadFor({ 0: { branch: 0, slots: { 2: "remembered" } } }))
    live.state.setState({ editing: true })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("remembered")) {
        throw new Error("still waiting")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(transport).not.toHaveBeenCalled()
  })

  test("writing a state its current value refetches nothing", async () => {
    document.body.innerHTML = PAGE

    const transport = vi.fn(async () => payloadFor({}))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "" })

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(transport).not.toHaveBeenCalled()
  })

  test("writing a state a server read depends on refetches debounced, once", async () => {
    document.body.innerHTML = PAGE

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return payloadFor({ 3: "3 results" })
    })

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 10 } })

    live.state.setState({ q: "a" })
    live.state.setState({ q: "ab" })
    live.state.setState({ q: "abc" })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("3 results")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(calls[0][FILE].q).toBe("abc")
  })

  test("a settled mutation refetches the server reads, steered", async () => {
    document.body.innerHTML = PAGE

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return payloadFor({ 3: "2 results" })
    })

    start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    mutationSettled()

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("2 results")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(calls[0][FILE]).toBeDefined()
  })

  test("a settled mutation stays quiet with refetch off", async () => {
    document.body.innerHTML = PAGE

    const transport = vi.fn(async () => payloadFor({}))

    start({ state: { refetchTransport: transport, refetchDebounce: 0, refetch: "off" } })

    mutationSettled()

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(transport).not.toHaveBeenCalled()
  })

  test("refetch off leaves the network alone", async () => {
    document.body.innerHTML = PAGE

    const transport = vi.fn(async () => payloadFor({}))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0, refetch: "off" } })

    live.state.setState({ editing: true })
    live.state.setState({ q: "abc" })

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(transport).not.toHaveBeenCalled()
  })

  test("a manual refresh works without any state manifest", async () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<p><!--herb-slot:0--><!--/herb-slot:0--></p>` +
      `<!--/herb-region:${FILE}-->`

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return payloadFor({ 0: "fresh" })
    })

    const live = start({ state: { refetchTransport: transport } })
    const report = await live.refresh()

    expect(report.applied).toBe(1)
    expect(calls[0]).toEqual({})
    expect(document.body.innerHTML).toContain("fresh")
  })

  test("data-herb-action fires $refresh and reports unknown actions", async () => {
    document.body.innerHTML =
      PAGE +
      `<button id="go" data-herb-action="$refresh">refresh</button>` +
      `<button id="bad" data-herb-action="somethingCustom">nope</button>`

    const transport = vi.fn(async () => payloadFor({}))
    const reportSink = vi.fn()

    vi.stubGlobal("HerbDevTools", { report: reportSink })

    try {
      start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

      document.querySelector<HTMLButtonElement>("#go")!.click()

      await vi.waitFor(() => {
        if (transport.mock.calls.length === 0) {
          throw new Error("still waiting")
        }
      })

      document.querySelector<HTMLButtonElement>("#bad")!.click()

      await vi.waitFor(() => {
        if (reportSink.mock.calls.length === 0) {
          throw new Error("still waiting")
        }
      })

      const reported = reportSink.mock.calls.flat(2) as Array<{ code?: string, message?: string }>
      const entry = reported.find((diagnostic) => diagnostic.code === "herb-invalid-action")

      expect(entry?.message).toContain("somethingCustom")
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
