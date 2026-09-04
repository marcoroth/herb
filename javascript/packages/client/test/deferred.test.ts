import { describe, test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

import type { Payload } from "../src/types"

const FILE = "app/views/chat/deferred.html.erb"

function deferredPage(mode: "lazy" | "async", spacer = ""): string {
  return (
    spacer +
    `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><p class="pulse">loading stats</p><!--/herb-slot:0--></div>` +
    `<!--/herb-region:${FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      states: {
        [FILE]: {
          version: "aaaaaaaa",
          declarations: [{ name: "_herb_block_0", kind: "boolean", default: "false", value: false, scope: "region", internal: true }],
          reads: {},
          conditionals: { 0: { arms: [{ branch: 0, condition: ["_herb_block_0", null] }], else: 1 } },
          presence: {},
          computed: {},
          server: { branches: { 0: [{ index: 1, node_path: [1, 0] }] }, reads: {} },
          fragments: { 0: { mode, state: "_herb_block_0", fallback: 1 } },
        },
      },
    })}</template>`
  )
}

const PRIMARY: Payload = {
  template: FILE,
  version: "aaaaaaaa",
  occurrence: 0,
  slots: {
    0: { branch: 0, statics: `<!--herb-branch:0:0--><p id="stats"><!--herb-slot:1--><!--/herb-slot:1--></p>`, slots: { 1: "42 things" } },
  },
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

describe("deferred blocks", () => {
  test("an async block requests once on mount, steered, and materializes the primary", async () => {
    document.body.innerHTML = deferredPage("async")

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return PRIMARY
    })

    start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    expect(document.body.innerHTML).toContain("loading stats")

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(calls[0][FILE]._herb_block_0).toBe(true)
    expect(document.body.innerHTML).not.toContain("loading stats")
  })

  test("a deferred block re-requests when its page comes back", async () => {
    const page = deferredPage("async")

    document.body.innerHTML = page

    const transport = vi.fn(async () => PRIMARY)

    start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    document.body.innerHTML = "<p>another page</p>"

    await new Promise((resolve) => setTimeout(resolve, 20))

    document.body.innerHTML = page

    expect(document.body.innerHTML).toContain("loading stats")

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(2)
  })

  test("a lazy block waits for the viewport and then materializes", async () => {
    document.body.innerHTML = deferredPage("lazy", `<div id="spacer" style="height:3000px"></div>`)

    const transport = vi.fn(async () => PRIMARY)

    start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(transport).not.toHaveBeenCalled()
    expect(document.body.innerHTML).toContain("loading stats")

    document.querySelector(".pulse")?.scrollIntoView()

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    expect(transport).toHaveBeenCalledTimes(1)
  })

  test("a lazy block inside a hidden container waits for it to show", async () => {
    document.body.innerHTML = `<div id="wrap" hidden>${deferredPage("lazy")}</div>`

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      return PRIMARY
    })

    start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(transport).not.toHaveBeenCalled()

    document.getElementById("wrap")!.hidden = false

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    expect(calls[0][FILE]._herb_block_0).toBe(true)
  })

  test("`hold` keeps the skeleton up when the block request lands fast", async () => {
    document.body.innerHTML =
      `<div id="wrap" hidden>` +
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><p class="pulse">loading stats</p><!--/herb-slot:0--></div>` +
      `<!--/herb-region:${FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({
        state: {},
        states: {
          [FILE]: {
            version: "aaaaaaaa",
            declarations: [
              { name: "q", kind: "string", default: '""', scope: "region" },
              { name: "_herb_block_0", kind: "boolean", default: "false", value: false, scope: "region", internal: true },
            ],
            reads: {},
            conditionals: { 0: { arms: [{ branch: 0, condition: ["_herb_block_0", null] }], else: 1 } },
            presence: {},
            computed: {},
            server: { branches: {}, reads: { q: [{ index: 1, node_path: [1, 0] }] } },
            fragments: { 0: { mode: "lazy", state: "_herb_block_0", fallback: 1, reads: [1], delay: 0, hold: 200 } },
          },
        },
      })}</template>` +
      `</div>`

    const calls: Array<Record<string, Record<string, unknown>>> = []
    const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
      calls.push(state)

      if (state[FILE]?._herb_block_0 === true) {
        return PRIMARY
      }

      return { template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 0: { branch: 1, slots: {} } } }
    })

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 30 } })

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(transport).not.toHaveBeenCalled()

    live.state.setState({ q: "x" })
    document.getElementById("wrap")!.hidden = false

    await vi.waitFor(() => {
      if (transport.mock.calls.length === 0) {
        throw new Error("still waiting")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(document.body.innerHTML).toContain("loading stats")
    expect(document.body.innerHTML).not.toContain("42 things")

    await vi.waitFor(() => {
      if (!document.body.innerHTML.includes("42 things")) {
        throw new Error("still waiting")
      }
    })

    expect(calls[calls.length - 1][FILE]._herb_block_0).toBe(true)
  })

  test("a refetch before the trigger keeps the fallback", async () => {
    document.body.innerHTML = deferredPage("lazy", `<div id="spacer" style="height:3000px"></div>`)

    const transport = vi.fn(async () => ({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { branch: 1, slots: {} } },
    }))

    const live = start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    await live.refresh()

    expect(document.body.innerHTML).toContain("loading stats")
    expect(document.body.innerHTML).not.toContain("42 things")
  })
})
