import { describe, test, expect, afterEach, vi } from "vitest"

import { HerbDevTools } from "../src/herb-dev-tools.js"

afterEach(() => {
  HerbDevTools.instance?.stop()
  delete (window as any).HerbDevTools
  vi.restoreAllMocks()
})

describe("starting dev tools", () => {
  test("starts when the page has none", () => {
    expect(HerbDevTools.start({ overlay: false })).not.toBeNull()
    expect(window.HerbDevTools).toBeDefined()
  })

  test("does not start a second time", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    HerbDevTools.start({ overlay: false })

    expect(HerbDevTools.start({ overlay: false })).toBeNull()
  })

  test("stands down for dev tools another copy of this class already started", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    ;(window as any).HerbDevTools = { fromAnotherBundle: true }

    expect(HerbDevTools.start({ overlay: false })).toBeNull()
    expect((window as any).HerbDevTools.fromAnotherBundle).toBe(true)
  })
})
