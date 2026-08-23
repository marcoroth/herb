import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

import { clearOnNavigation, resetReport } from "../src/report"

import type { RuntimeDiagnostic } from "../src/report"

const FILE = "app/views/page/chat.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1-->done<!--/herb-slot:0--></div>` +
  `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:0-->busy<!--herb-branch:0:1-->done</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [
          { name: "busy", kind: "boolean", default: "false", scope: "region", line: 1, column: 4 },
          { name: "sort", kind: "string", default: '"name"', scope: "region", line: 1, column: 4 },
        ],
        reads: {},
        conditionals: { 0: { arms: [["busy", null, 0]], else: 1 } },
      },
    },
  })}</template>`

interface FakeDevTools {
  report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): void
  entries: RuntimeDiagnostic[]
}

function installDevTools(): FakeDevTools {
  const devTools: FakeDevTools = {
    entries: [],
    report(input) {
      devTools.entries.push(...(Array.isArray(input) ? input : [input]))
    },
  }

  ;(window as unknown as { HerbDevTools?: FakeDevTools }).HerbDevTools = devTools

  return devTools
}

let slots: SlotIndex
let state: SlotState

beforeEach(() => {
  resetReport()

  document.body.innerHTML = PAGE
  document.head.innerHTML = ""

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, { persist: "none" })
  state.adopt()
})

afterEach(() => {
  delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
})

describe("runtime diagnostics", () => {
  test("toggle on a non-boolean reports the declaration and still throws", () => {
    const devTools = installDevTools()

    expect(() => state.toggle("sort")).toThrow(TypeError)

    expect(devTools.entries).toHaveLength(1)
    expect(devTools.entries[0]).toMatchObject({
      template: FILE,
      code: "herb-state-type",
      origin: "Herb Client Runtime",
      location: { start: { line: 1, column: 4 } },
    })
    expect(state.getState("sort")).toBe("name")
  })

  test("an unknown state lists what is in scope", () => {
    const devTools = installDevTools()

    expect(state.setState({ missing: true })).toBe(false)

    expect(devTools.entries[0].code).toBe("herb-unknown-state")
  })

  test("a version mismatch reports and declines", () => {
    document.body.innerHTML = PAGE.split(`${FILE}:aaaaaaaa:0`).join(`${FILE}:bbbbbbbb:0`).replace(
      `data-herb-region="${FILE}:aaaaaaaa"`,
      `data-herb-region="${FILE}:bbbbbbbb"`,
    )
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()

    const devTools = installDevTools()

    expect(state.setState({ busy: true })).toBe(false)
    expect(devTools.entries[0].code).toBe("herb-stale-version")
  })

  test("diagnostics raised before the dev tools start are queued when debugging", () => {
    document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`

    state.setState({ missing: true })

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(devTools.entries.map((entry) => entry.code)).toEqual(["herb-unknown-state", "herb-unknown-state"])
  })

  test("a navigation clears the runtime's own findings and the queue", () => {
    document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`

    const stop = clearOnNavigation()

    document.dispatchEvent(new Event("turbo:load"))

    state.setState({ missing: true })
    document.dispatchEvent(new Event("turbo:load"))

    const devTools = installDevTools()
    const cleared: (string | undefined)[] = []

    ;(devTools as unknown as { clear(origin?: string): void }).clear = (origin) => cleared.push(origin)

    state.setState({ also_missing: true })
    expect(devTools.entries.map((entry) => entry.value)).toEqual(["also_missing"])

    document.dispatchEvent(new Event("turbo:load"))
    expect(cleared).toEqual(["Herb Client Runtime"])

    stop()
  })

  test("falls back to the console while the panel is absent in debug mode", async () => {
    const { vi } = await import("vitest")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`
    state.setState({ missing: true })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain("[herb]")

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(devTools.entries).toHaveLength(2)

    warn.mockRestore()
  })

  test("production logs nothing to the console", async () => {
    const { vi } = await import("vitest")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    state.setState({ missing: true })

    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  test("without the debug signal diagnostics still queue for a late panel", () => {
    state.setState({ missing: true })

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing", "also_missing"])
  })

  test("the landing page's own turbo:load keeps its diagnostics", () => {
    const stop = clearOnNavigation()

    state.setState({ missing: true })
    document.dispatchEvent(new Event("turbo:load"))

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing", "also_missing"])

    stop()
  })
})
