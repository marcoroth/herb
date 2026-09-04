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

  test("closing a branch over its own reads refetches nothing", async () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><!--/herb-slot:0--></div>` +
      `<template data-herb-region="${FILE}:aaaaaaaa">` +
      `<!--herb-branch:0:0--><p><!--herb-slot:2--><!--/herb-slot:2--></p>` +
      `<!--herb-branch:0:1-->` +
      `</template>` +
      `<!--/herb-region:${FILE}-->` +
      dependencies({
        version: "aaaaaaaa",
        declarations: [{ name: "album", kind: "string", default: '""', value: "", scope: "region" }],
        reads: {},
        conditionals: { 0: { arms: [{ branch: 0, condition: ["album", null, "present"] }], else: 1 } },
        presence: {},
        computed: {},
        server: { reads: { album: [{ index: 2, node_path: [1, 0] }] }, branches: { 0: [{ index: 2, node_path: [1, 0] }] } },
      })

    const transport = vi.fn(async () => payloadFor({ 0: { branch: 0, slots: { 2: "opened" } } }))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ album: "acid-archive" })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("opened")) {
        throw new Error("still waiting")
      }
    })

    const settled = transport.mock.calls.length

    live.state.setState({ album: "" })

    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(document.body.innerHTML).not.toContain("opened")
    expect(transport.mock.calls.length).toBe(settled)
  })

  test("parked branches and captured material list as parked roots", async () => {
    document.body.innerHTML = PAGE

    const live = start({ state: { refetch: "off" } })
    const roots = live.slots.parkedRoots()

    expect(roots.length).toBeGreaterThan(0)
    expect(roots.some((root) => root.querySelector("em") !== null)).toBe(true)
  })

  test("writing a state its current value refetches nothing", async () => {
    document.body.innerHTML = PAGE

    const transport = vi.fn(async () => payloadFor({}))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "" })

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(transport).not.toHaveBeenCalled()
  })

  test("a fragment scoped with `on` only masks for its named states", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 0, hold: 0, on: ["editing"] } })

    let resolveTransport: (payload: Payload) => void = () => {}
    const transport = vi.fn(() => new Promise<Payload>((resolve) => { resolveTransport = resolve }))

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "basel" })

    expect(document.body.innerHTML).toContain("old answer")
    expect(document.body.innerHTML).not.toContain("looking it up")

    await vi.waitFor(() => {
      expect(transport).toHaveBeenCalled()
    })

    expect(document.body.innerHTML).not.toContain("looking it up")

    resolveTransport(payloadFor({ 4: { branch: 0, slots: { 3: "fresh answer" } } }))

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fresh answer")) {
        throw new Error("still waiting")
      }
    })
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

  function fragmentPage(fragments: Record<string, unknown>): string {
    return (
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:4:conditional--><!--herb-branch:4:0--><p><!--herb-slot:3-->old answer<!--/herb-slot:3--></p><!--/herb-slot:4--></div>` +
      `<template data-herb-region="${FILE}:aaaaaaaa">` +
      `<!--herb-branch:4:0--><p><!--herb-slot:3--><!--/herb-slot:3--></p>` +
      `<!--herb-branch:4:1--><p class="pulse">looking it up</p>` +
      `</template>` +
      `<!--/herb-region:${FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({
        state: {},
        states: {
          [FILE]: {
            ...STATES,
            server: { branches: {}, reads: { q: [{ index: 3, node_path: [1, 0] }] } },
            fragments,
          },
        },
      })}</template>`
    )
  }

  test("a stale server read swaps its fragment to the fallback until the refetch lands", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 0, hold: 0 } })

    let resolveTransport: (payload: Payload) => void = () => {}
    const transport = vi.fn(() => new Promise<Payload>((resolve) => { resolveTransport = resolve }))

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "basel" })

    expect(document.body.innerHTML).toContain("looking it up")
    expect(document.body.innerHTML).not.toContain("old answer")

    await vi.waitFor(() => {
      if (transport.mock.calls.length === 0) {
        throw new Error("still waiting")
      }
    })

    resolveTransport(payloadFor({ 4: { branch: 0, slots: { 3: "fresh answer" } } }))

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fresh answer")) {
        throw new Error("still waiting")
      }
    })

    expect(document.body.innerHTML).not.toContain("looking it up")
  })

  test("refetch off never swaps a fragment", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 0, hold: 0 } })

    const transport = vi.fn(async () => payloadFor({}))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0, refetch: "off" } })

    live.state.setState({ q: "basel" })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(document.body.innerHTML).toContain("old answer")
    expect(transport).not.toHaveBeenCalled()
  })

  test("the fallback waits out `delay` before it appears", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 40, hold: 0 } })

    let resolveTransport: (payload: Payload) => void = () => {}
    const transport = vi.fn(() => new Promise<Payload>((resolve) => { resolveTransport = resolve }))

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "basel" })

    expect(document.body.innerHTML).toContain("old answer")
    expect(document.body.innerHTML).not.toContain("looking it up")

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("looking it up")) {
        throw new Error("still waiting")
      }
    })

    resolveTransport(payloadFor({ 4: { branch: 0, slots: { 3: "fresh answer" } } }))

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fresh answer")) {
        throw new Error("still waiting")
      }
    })
  })

  test("a refetch that lands inside `delay` never shows the fallback", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 60, hold: 0 } })

    const transport = vi.fn(async () => payloadFor({ 4: { branch: 0, slots: { 3: "fresh answer" } } }))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "basel" })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fresh answer")) {
        throw new Error("still waiting")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(document.body.innerHTML).toContain("fresh answer")
    expect(document.body.innerHTML).not.toContain("looking it up")
  })

  test("`hold` keeps the fallback up after a fast payload", async () => {
    document.body.innerHTML = fragmentPage({ 4: { fallback: 1, reads: [3], delay: 0, hold: 100 } })

    const transport = vi.fn(async () => payloadFor({ 4: { branch: 0, slots: { 3: "fresh answer" } } }))
    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ q: "basel" })

    expect(document.body.innerHTML).toContain("looking it up")

    await vi.waitFor(() => {
      if (transport.mock.calls.length === 0) {
        throw new Error("still waiting")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(document.body.innerHTML).toContain("looking it up")
    expect(document.body.innerHTML).not.toContain("fresh answer")

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fresh answer")) {
        throw new Error("still waiting")
      }
    })

    expect(document.body.innerHTML).not.toContain("looking it up")
  })

  test("a payload carrying statics materializes a branch the page never parked", () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
      `<!--/herb-region:${FILE}-->`

    const live = start()
    const report = live.slots.apply(payloadFor({
      0: { branch: 0, statics: "<!--herb-branch:0:0--><em><!--herb-slot:1--><!--/herb-slot:1--></em>", slots: { 1: "unrolled" } },
    }))

    expect(report.deferred).toEqual([])
    expect(document.body.innerHTML).toContain("<em>")
    expect(document.body.innerHTML).toContain("unrolled")
  })

  test("a payload's statics let a stuck state branch finally flip", async () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
      `<b><!--herb-slot:3--><!--/herb-slot:3--></b>` +
      `<!--/herb-region:${FILE}-->` +
      dependencies(STATES)

    const live = start({ state: { refetchTransport: async () => payloadFor({}), refetchDebounce: 0 } })

    live.state.setState({ editing: true })

    expect(document.body.innerHTML).toContain("off")

    live.slots.apply(payloadFor({
      0: { branch: 0, statics: "<!--herb-branch:0:0--><em><!--herb-slot:2--><!--/herb-slot:2--></em>", slots: { 2: "arrived" } },
    }))

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("arrived")) {
        throw new Error("still waiting")
      }
    })

    expect(document.body.innerHTML).not.toContain("<p>off</p>")
  })

  test("a state flip with no material refetches and unrolls the branch", async () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
      `<b><!--herb-slot:3--><!--/herb-slot:3--></b>` +
      `<!--/herb-region:${FILE}-->` +
      dependencies(STATES)

    const transport = vi.fn(async () => payloadFor({
      0: { branch: 0, statics: "<!--herb-branch:0:0--><em><!--herb-slot:2--><!--/herb-slot:2--></em>", slots: { 2: "fetched" } },
    }))

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    live.state.setState({ editing: true })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("fetched")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalled()
    expect(document.body.innerHTML).not.toContain("<p>off</p>")
  })

  test("a materialized branch focuses its autofocus element", () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
      `<!--/herb-region:${FILE}-->`

    const live = start()

    live.slots.apply(payloadFor({
      0: { branch: 0, statics: "<!--herb-branch:0:0--><input autofocus placeholder=\"draft\">", slots: {} },
    }))

    expect((document.activeElement as HTMLInputElement)?.placeholder).toBe("draft")
  })

  test("a branch flip with no material defers and says so", () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><p>off</p><!--/herb-slot:0--></div>` +
      `<!--/herb-region:${FILE}-->`

    const reportSink = vi.fn()

    vi.stubGlobal("HerbDevTools", { report: reportSink })

    try {
      const live = start()
      const report = live.slots.apply(payloadFor({ 0: { branch: 0, slots: {} } }))

      expect(report.deferred).toHaveLength(1)

      const reported = reportSink.mock.calls.flat(2) as Array<{ code?: string }>

      expect(reported.some((diagnostic) => diagnostic.code === "herb-slots-materialize")).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
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
      expect(reported.every((diagnostic) => diagnostic.code !== "herb-unknown-state")).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
