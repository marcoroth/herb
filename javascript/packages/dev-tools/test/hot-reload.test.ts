import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { diffStateManifests } from "../src/dev-server/manifest-diff"

import { Runtime } from "@herb-tools/client"
import { HotReload } from "../src/dev-server/hot-reload"
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

const COLLECTION_PAGE = `<!--herb-region:${FILE}:a571ac7d:0--><ul><!--herb-slot:0:collection--><!--herb-item:0:a--><li id="a" data-herb-slot="1:attribute:id 2:child">a</li><!--/herb-item:0--><!--/herb-slot:0--></ul><template data-herb-region="${FILE}:a571ac7d"><!--herb-branch:0:item--><!--herb-item:0:--><li id="" data-herb-slot="1:attribute:id 2:child"></li><!--/herb-item:0--></template><!--/herb-region:${FILE}-->`

const COLLECTION_SCHEMA: Partial<SchemaMessage> = {
  version: { from: "a571ac7d", to: "c3604c3e" },
  static_markup: `<p>hello</p><ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul>`,
  statics: { "0:item": `<!--herb-branch:0:item--><!--herb-item:0:--><li id="" data-herb-slot="1:attribute:id 2:child"></li><!--/herb-item:0-->` },
  remap: { slots: { "0": 0, "1": 1, "2": 2 } },
}

describe("a static edit with live collection items", () => {
  test("reshapes in place, keeping item nodes, without fetching or reloading", async () => {
    document.body.innerHTML = COLLECTION_PAGE

    const runtime = Runtime.start()
    const reload = vi.fn()
    const fetchSpy = vi.fn()

    vi.stubGlobal("fetch", fetchSpy)

    const row = document.getElementById("a")

    try {
      const hotReload = new HotReload({ runtime: () => runtime, reload })

      hotReload.onSchema(schema(COLLECTION_SCHEMA))
      hotReload.onInvalidate(invalidate({ version: "c3604c3e", scope: "static" }))

      await vi.waitFor(() => {
        if (!document.body.innerHTML.includes("hello")) {
          throw new Error("still waiting")
        }
      })

      expect(reload).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(document.body.innerHTML).toContain("<p>hello</p>")
      expect(document.getElementById("a")).toBe(row)
      expect(runtime.slots.regionsFor(FILE)[0].version).toBe("c3604c3e")
    } finally {
      vi.unstubAllGlobals()
      runtime.stop()
    }
  })

  test("changed item statics reshape every row in place without fetching", async () => {
    document.body.innerHTML = COLLECTION_PAGE

    const runtime = Runtime.start()
    const reload = vi.fn()
    const fetchSpy = vi.fn()

    vi.stubGlobal("fetch", fetchSpy)

    const rowA = document.getElementById("a")

    try {
      const hotReload = new HotReload({ runtime: () => runtime, reload })

      hotReload.onSchema(schema({
        ...COLLECTION_SCHEMA,
        statics: { "0:item": `<!--herb-branch:0:item--><!--herb-item:0:--><li class="row" id="" data-herb-slot="1:attribute:id 2:child"></li><!--/herb-item:0-->` },
      }))
      hotReload.onInvalidate(invalidate({ version: "c3604c3e", scope: "static" }))

      await vi.waitFor(() => {
        if (reload.mock.calls.length === 0 && document.getElementById("a")?.className !== "row") {
          throw new Error("still waiting")
        }
      })

      expect(reload).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(document.getElementById("a")).toBe(rowA)
      expect(document.getElementById("a")?.className).toBe("row")
      expect(document.getElementById("a")?.textContent).toBe("a")
    } finally {
      vi.unstubAllGlobals()
      runtime.stop()
    }
  })
})

describe("a raising re-render", () => {
  test("reports the Ruby error class to the panel and holds the page", async () => {
    document.body.innerHTML = COLLECTION_PAGE

    const runtime = Runtime.start()
    const reload = vi.fn()
    const report = vi.fn()
    const sink = { report, clear: vi.fn(), clearAll: vi.fn() }

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { class: "NoMethodError", message: "undefined method 'oops'", template: FILE, backtrace: ["app/models/message.rb:12:in 'oops'", "app/views/chat/show.html.erb:5"] },
    }), { status: 500 })))

    try {
      const hotReload = new HotReload({ runtime: () => runtime, reload, sink: () => sink })

      hotReload.onSchema(schema({ version: { from: "a571ac7d", to: "a571ac7d" } }))
      hotReload.onInvalidate(invalidate({ version: "a571ac7d", scope: "fetch" }))

      await vi.waitFor(() => {
        if (report.mock.calls.length === 0) {
          throw new Error("still waiting")
        }
      })

      expect(reload).not.toHaveBeenCalled()

      const diagnostics = report.mock.calls[0][1] as Array<{ code?: string, message?: string, backtrace?: string[] }>

      expect(diagnostics[diagnostics.length - 1]?.code).toBe("NoMethodError")
      expect(diagnostics[diagnostics.length - 1]?.message).toBe("undefined method 'oops'")
      expect(diagnostics[diagnostics.length - 1]?.backtrace).toEqual(["app/models/message.rb:12:in 'oops'", "app/views/chat/show.html.erb:5"])
    } finally {
      vi.unstubAllGlobals()
      runtime.stop()
    }
  })
})

describe("pairing schema and invalidate", () => {
  test("without a runtime, an invalidate reloads", () => {
    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload })

    hotReload.onSchema(schema())
    hotReload.onInvalidate(invalidate())

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("disabled hot reloading leaves the page alone", () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload, graceMs: 250 })

    hotReload.setEnabled(false)
    hotReload.onSchema(schema())
    hotReload.onInvalidate(invalidate())
    vi.runAllTimers()

    expect(reload).not.toHaveBeenCalled()
  })

  test("re-enabling hot reloading resumes tier resolution", () => {
    const reload = vi.fn()
    const hotReload = new HotReload({ runtime: () => null, reload })

    hotReload.setEnabled(false)
    hotReload.setEnabled(true)
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
