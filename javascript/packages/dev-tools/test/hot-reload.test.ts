import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { HotReload } from "../src/dev-server/hot-reload"
import { diffStateManifests } from "../src/dev-server/manifest-diff"
import { HerbDevTools } from "../src/herb-dev-tools"

import type { InvalidateMessage, SchemaMessage } from "../src/dev-server/types"
import type { StateManifest } from "@herb-tools/client"

const FILE = "app/views/posts/index.html.erb"

function invalidate(overrides: Partial<InvalidateMessage> = {}): InvalidateMessage {
  return { type: "invalidate", file: FILE, version: "bbbbbbbb", node_path: [0], scope: "fetch", ...overrides }
}

function schema(overrides: Partial<SchemaMessage> = {}): SchemaMessage {
  return {
    type: "schema",
    file: FILE,
    mode: "client",
    version: { from: "aaaaaaaa", to: "bbbbbbbb" },
    manifest: null,
    static_markup: null,
    statics: null,
    remap: null,
    diagnostics: [],
    source: null,
    ...overrides,
  }
}

beforeEach(() => {
  document.body.innerHTML = ""
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("pairing schema and invalidate", () => {
  test("without a runtime, an invalidate reloads", () => {
    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload })

    hotReload.onSchema(schema())
    hotReload.onInvalidate(invalidate())

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("an invalidate without a schema waits out the grace window before resolving", () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload, graceMs: 250 })

    hotReload.onInvalidate(invalidate())

    expect(reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("a schema arriving inside the grace window resolves immediately", () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload, graceMs: 250 })

    hotReload.onInvalidate(invalidate())
    hotReload.onSchema(schema())

    expect(reload).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("a standalone invalidate resolves without waiting", () => {
    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload })

    hotReload.onInvalidate(invalidate({ version: null }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("an error clears the pending work so a broken compile keeps the old page", () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload, graceMs: 250 })

    hotReload.onInvalidate(invalidate())
    hotReload.onError({ type: "error", file: FILE, errors: [] })

    vi.advanceTimersByTime(1000)

    expect(reload).not.toHaveBeenCalled()
  })
})

describe("capability notes", () => {
  test("says why it fell back, once, through the sink", () => {
    const reported: string[] = []
    const sink = {
      report: (file: string) => {
        reported.push(file)
      },
      clear: () => {},
      clearAll: () => {},
    }

    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload, sink: () => sink })

    hotReload.onInvalidate(invalidate({ version: null }))
    hotReload.onInvalidate(invalidate({ version: null }))

    expect(reported.filter((file) => file.includes("no-runtime"))).toHaveLength(1)
    expect(reported.filter((file) => file.includes("standalone"))).toHaveLength(1)
  })
})

describe("diffStateManifests", () => {
  const manifest = (overrides: Partial<StateManifest> = {}): StateManifest => ({
    version: "aaaaaaaa",
    declarations: [],
    reads: {},
    conditionals: {},
    ...overrides,
  })

  test("identical manifests are derivable", () => {
    const delta = diffStateManifests(manifest(), manifest())

    expect(delta.identical).toBe(true)
    expect(delta.stateDerivable).toBe(true)
  })

  test("changed reads stay derivable while declarations agree", () => {
    const delta = diffStateManifests(manifest({ reads: { count: [0] } }), manifest({ version: "bbbbbbbb", reads: { count: [1] } }))

    expect(delta.identical).toBe(false)
    expect(delta.stateDerivable).toBe(true)
    expect(delta.changedReads).toEqual(["count"])
  })

  test("changed declarations are not derivable", () => {
    const before = manifest({ declarations: [{ name: "count", kind: "integer" }] as never })
    const after = manifest({ declarations: [] })

    expect(diffStateManifests(before, after).stateDerivable).toBe(false)
  })

  test("a server read is never derivable", () => {
    const delta = diffStateManifests(manifest(), manifest({ server: { count: [{ index: 1, node_path: [0] }] } }))

    expect(delta.stateDerivable).toBe(false)
  })

  test("a missing manifest is not derivable", () => {
    expect(diffStateManifests(null, manifest()).stateDerivable).toBe(false)
  })
})

describe("the per-file diagnostics sink", () => {
  test("fixing one file leaves another file's diagnostics standing", () => {
    const devTools = HerbDevTools.start({ devServer: false, overlay: false })

    expect(devTools).not.toBeNull()

    try {
      const sink = (devTools as unknown as { diagnosticSink(): { report(file: string, diagnostics: unknown[]): void } }).diagnosticSink()

      const diagnostic = (template: string) => ({
        template,
        message: `broken in ${template}`,
        severity: "error",
        origin: "Herb Dev Server",
      })

      sink.report("a.html.erb", [diagnostic("a.html.erb")])
      sink.report("b.html.erb", [diagnostic("b.html.erb")])

      expect(document.body.textContent).toContain("broken in a.html.erb")
      expect(document.body.textContent).toContain("broken in b.html.erb")

      sink.report("b.html.erb", [])

      expect(document.body.textContent).toContain("broken in a.html.erb")
      expect(document.body.textContent).not.toContain("broken in b.html.erb")
    } finally {
      devTools?.stop()
    }
  })
})
