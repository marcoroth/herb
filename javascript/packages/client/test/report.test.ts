import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Slots } from "../src/slots/slots"
import { Actions } from "../src/actions/actions"
import { State } from "../src/state/state"

import { clearOnNavigation, report, resetReport, DEV_TOOLS_START_EVENT } from "../src/shared/report"

import type { RuntimeDiagnostic } from "../src/shared/types"

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
  clear(origin?: string): void
  entries: RuntimeDiagnostic[]
}

function installDevTools(): FakeDevTools {
  const devTools: FakeDevTools = {
    entries: [],
    report(input) {
      devTools.entries.push(...(Array.isArray(input) ? input : [input]))
    },
    clear(origin) {
      devTools.entries = devTools.entries.filter((entry) => origin !== undefined && entry.origin !== origin)
    },
  }

  ;(window as unknown as { HerbDevTools?: FakeDevTools }).HerbDevTools = devTools

  return devTools
}

let slots: Slots
let state: State

beforeEach(() => {
  resetReport()

  document.body.innerHTML = PAGE
  document.head.innerHTML = ""

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, { persist: "none" })
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

  test("a diagnostic raised by an action carries the element it is about", () => {
    const devTools = installDevTools()
    const button = document.createElement("button")

    button.setAttribute("data-herb-toggle", "nope")
    document.body.appendChild(button)

    const actions = new Actions(state)

    actions.start(document.body)

    const entry = devTools.entries.find((candidate) => candidate.code === "herb-unknown-state")

    expect(entry?.element).toBe(button)

    actions.stop()
  })

  test("an unknown state lists what is in scope", () => {
    const devTools = installDevTools()

    expect(state.setState({ missing: true })).toBe(false)

    expect(devTools.entries[0].code).toBe("herb-unknown-state")
    expect(devTools.entries[0].template).toBe(FILE)
  })

  test("a version mismatch reports and declines", () => {
    document.body.innerHTML = PAGE.split(`${FILE}:aaaaaaaa:0`).join(`${FILE}:bbbbbbbb:0`).replace(
      `data-herb-region="${FILE}:aaaaaaaa"`,
      `data-herb-region="${FILE}:bbbbbbbb"`,
    )
    slots = new Slots()
    slots.scan(document.body)
    state = new State(slots, { persist: "none" })
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

    state.setState({ missing: true })
    document.dispatchEvent(new Event("turbo:before-render"))

    const devTools = installDevTools()
    const cleared: (string | undefined)[] = []

    ;(devTools as unknown as { clear(origin?: string): void }).clear = (origin) => cleared.push(origin)

    state.setState({ also_missing: true })
    expect(devTools.entries.map((entry) => entry.value)).toEqual(["also_missing"])

    document.dispatchEvent(new Event("turbo:before-render"))
    expect(cleared).toEqual(["Herb Client Runtime"])

    stop()
  })

  test("falls back to the console while the panel is absent in debug mode", async () => {
    const { vi } = await import("vitest")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`
    state.setState({ missing: true })

    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0][0])).toContain("[herb]")
    expect(warn).not.toHaveBeenCalled()

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(error).toHaveBeenCalledTimes(1)
    expect(devTools.entries).toHaveLength(2)

    warn.mockRestore()
    error.mockRestore()
  })

  test("the console fallback follows the severity", async () => {
    const { vi } = await import("vitest")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`

    report({ template: "t.html.erb", message: "soft", severity: "warning" })
    report({ template: "t.html.erb", message: "hard", severity: "error" })
    report({ template: "t.html.erb", message: "quiet" })

    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(["[herb] soft", "[herb] quiet"])
    expect(error.mock.calls.map((call) => String(call[0]))).toEqual(["[herb] hard"])

    warn.mockRestore()
    error.mockRestore()
  })

  test("the dev tools' start event flushes the queue without another report", () => {
    state.setState({ missing: true })
    state.setState({ also_missing: true })

    const devTools = installDevTools()

    expect(devTools.entries).toHaveLength(0)

    document.dispatchEvent(new CustomEvent(DEV_TOOLS_START_EVENT))

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing", "also_missing"])

    document.dispatchEvent(new CustomEvent(DEV_TOOLS_START_EVENT))

    expect(devTools.entries).toHaveLength(2)
  })

  test("a bundle that assigns the global without announcing itself still gets the queue", async () => {
    state.setState({ missing: true })

    const devTools = installDevTools()

    expect(devTools.entries).toHaveLength(0)

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing"])
    expect((window as unknown as { HerbDevTools?: unknown }).HerbDevTools).toBe(devTools)

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools

    expect((window as unknown as { HerbDevTools?: unknown }).HerbDevTools).toBeUndefined()
  })

  test("the hook re-installs after the dev tools stop and the global is deleted", async () => {
    state.setState({ missing: true })

    const first = installDevTools()

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))

    expect(first.entries).toHaveLength(1)

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools

    state.setState({ also_missing: true })

    const second = installDevTools()

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))

    expect(second.entries.map((entry) => entry.value)).toEqual(["also_missing"])
  })

  test("a dangling undefined global is replaced by the hook", async () => {
    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = undefined

    state.setState({ missing: true })

    const devTools = installDevTools()

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing"])
  })

  test("the window load event flushes a queue the dev tools were late for", () => {
    state.setState({ missing: true })

    const devTools = installDevTools()

    window.dispatchEvent(new Event("load"))

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing"])
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

  test("a full page load keeps its diagnostics", () => {
    const stop = clearOnNavigation()

    state.setState({ missing: true })
    document.dispatchEvent(new Event("turbo:load"))

    const devTools = installDevTools()

    state.setState({ also_missing: true })

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["missing", "also_missing"])

    stop()
  })

  test("a navigated page keeps what its own scan reports", () => {
    const devTools = installDevTools()
    const stop = clearOnNavigation()

    state.setState({ missing: true })

    document.dispatchEvent(new Event("turbo:before-render"))
    expect(devTools.entries).toEqual([])

    state.setState({ also_missing: true })
    document.dispatchEvent(new Event("turbo:load"))

    expect(devTools.entries.map((entry) => entry.value)).toEqual(["also_missing"])

    stop()
  })
})
