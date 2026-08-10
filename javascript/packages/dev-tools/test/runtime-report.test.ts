import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import {
  MAX_RUNTIME_DIAGNOSTICS,
  RUNTIME_REPORT_VERSION,
  buildRenderStack,
  diagnosticKey,
  normalizeDiagnostic,
  normalizeRuntimeReport,
  parseRuntimeReport,
  readRuntimeReport,
  resetRuntimeReportWarnings,
} from "../src/runtime-report"

import type { NormalizedDiagnostic, RenderTreeNode } from "../src/runtime-report"

const COLLECTION_TREE: RenderTreeNode[] = [
  { id: "0", template: "app/views/layouts/application.html.erb", parent: null, via: "layout" },
  { id: "1", template: "app/views/posts/index.html.erb", parent: "0", via: "template", location: { line: 7, column: 10 } },
  { id: "2", template: "app/views/posts/_actions.html.erb", parent: "1", via: "partial", location: { line: 6, column: 10 } },
  { id: "3", template: "app/views/posts/_actions.html.erb", parent: "1", via: "partial", location: { line: 18, column: 4 } },
]

function diagnostic(overrides: Partial<NormalizedDiagnostic> = {}): NormalizedDiagnostic {
  return normalizeDiagnostic({
    template: "app/views/posts/_actions.html.erb",
    message: "Nested `<form>` elements are not allowed.",
    ...overrides,
  })!
}

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetRuntimeReportWarnings()

  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()

  document.body.innerHTML = ""
})

describe("parseRuntimeReport", () => {
  test("reads a complete payload", () => {
    const report = parseRuntimeReport(JSON.stringify({
      version: 1,
      renderTree: COLLECTION_TREE,
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        node: "2",
        message: "Nested `<form>` elements are not allowed.",
        code: "html-no-nested-forms",
        severity: "error",
        kind: "diagnostic",
        origin: "herb-linter",
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 38 } },
        suggestion: "Remove the inner form.",
        docsUrl: "https://herb-tools.dev/linter/rules/html-no-nested-forms",
      }],
      sources: { "app/views/posts/_actions.html.erb": "<form>\n</form>\n" },
    }))

    expect(report).not.toBeNull()
    expect(report!.version).toBe(RUNTIME_REPORT_VERSION)
    expect(report!.renderTree).toHaveLength(4)
    expect(report!.diagnostics).toHaveLength(1)
    expect(report!.diagnostics[0].code).toBe("html-no-nested-forms")
    expect(report!.diagnostics[0].location).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 38 } })
    expect(report!.sources["app/views/posts/_actions.html.erb"]).toContain("<form>")
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test("ignores a malformed payload without throwing", () => {
    expect(() => parseRuntimeReport("{ this is not json")).not.toThrow()
    expect(parseRuntimeReport("{ this is not json")).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  test("ignores an empty payload silently", () => {
    expect(parseRuntimeReport("")).toBeNull()
    expect(parseRuntimeReport(null)).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test("ignores an unknown version with a single warning", () => {
    expect(parseRuntimeReport(JSON.stringify({ version: 2, diagnostics: [] }))).toBeNull()
    expect(parseRuntimeReport(JSON.stringify({ version: 2, diagnostics: [] }))).toBeNull()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toContain("version 2")
  })

  test("ignores a payload without a version", () => {
    expect(parseRuntimeReport(JSON.stringify({ diagnostics: [] }))).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  test("ignores a payload that is not an object", () => {
    expect(normalizeRuntimeReport([1, 2, 3])).toBeNull()
    expect(normalizeRuntimeReport("nope")).toBeNull()
  })

  test("keeps a payload with zero diagnostics", () => {
    const report = parseRuntimeReport(JSON.stringify({ version: 1, diagnostics: [] }))

    expect(report).not.toBeNull()
    expect(report!.diagnostics).toEqual([])
  })
})

describe("normalizeDiagnostic", () => {
  test("requires template and message", () => {
    expect(normalizeDiagnostic({ message: "no template" })).toBeNull()
    expect(normalizeDiagnostic({ template: "a.html.erb" })).toBeNull()
    expect(normalizeDiagnostic("nope")).toBeNull()
  })

  test("drops only the unusable entries of a partial payload", () => {
    const report = normalizeRuntimeReport({
      version: 1,
      diagnostics: [
        { template: "a.html.erb", message: "first" },
        { message: "no template" },
        null,
        { template: "b.html.erb", message: "second" },
      ],
    })

    expect(report!.diagnostics.map(entry => entry.message)).toEqual(["first", "second"])
  })

  test("applies the documented defaults", () => {
    const entry = diagnostic()

    expect(entry.kind).toBe("diagnostic")
    expect(entry.severity).toBe("error")
    expect(entry.origin).toBe("unknown")
    expect(entry.code).toBeNull()
    expect(entry.location).toBeNull()
  })

  test("falls back to error for an unrecognized severity", () => {
    expect(diagnostic({ severity: "catastrophe" as any }).severity).toBe("error")
  })

  test("strips severity from a metric", () => {
    const entry = diagnostic({ kind: "metric", severity: "error" as any, value: "3 SQL queries" })

    expect(entry.kind).toBe("metric")
    expect(entry.severity).toBeNull()
    expect(entry.value).toBe("3 SQL queries")
  })

  test("clamps positions to 1-based coordinates", () => {
    const entry = diagnostic({ location: { start: { line: 0, column: -4 } } as any })

    expect(entry.location).toEqual({ start: { line: 1, column: 1 } })
  })
})

describe("normalizeRenderTree", () => {
  test("drops nodes without an id or template and de-duplicates ids", () => {
    const report = normalizeRuntimeReport({
      version: 1,
      renderTree: [
        { id: "0", template: "a.html.erb", parent: null, via: "layout" },
        { id: "0", template: "duplicate.html.erb", parent: null, via: "layout" },
        { template: "no-id.html.erb", parent: null, via: "layout" },
        { id: "9", parent: null, via: "layout" },
      ],
    })

    expect(report!.renderTree).toHaveLength(1)
    expect(report!.renderTree[0].template).toBe("a.html.erb")
  })

  test("falls back to template for an unrecognized via", () => {
    const report = normalizeRuntimeReport({
      version: 1,
      renderTree: [{ id: "0", template: "a.html.erb", parent: null, via: "teleport" }],
    })

    expect(report!.renderTree[0].via).toBe("template")
  })
})

describe("buildRenderStack", () => {
  test("walks parents innermost first", () => {
    const frames = buildRenderStack(COLLECTION_TREE, diagnostic({
      node: "2",
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 38 } },
    }))

    expect(frames.map(frame => `${frame.template}:${frame.line}:${frame.column}`)).toEqual([
      "app/views/posts/_actions.html.erb:1:1",
      "app/views/posts/index.html.erb:6:10",
      "app/views/layouts/application.html.erb:7:10",
    ])

    expect(frames.map(frame => frame.via)).toEqual(["partial", "template", "layout"])
  })

  test("distinguishes two occurrences of one template in a collection render", () => {
    const first = buildRenderStack(COLLECTION_TREE, diagnostic({ node: "2", location: { start: { line: 1, column: 1 } } }))
    const second = buildRenderStack(COLLECTION_TREE, diagnostic({ node: "3", location: { start: { line: 1, column: 1 } } }))

    expect(first[0].template).toBe(second[0].template)
    expect(first[1]).toEqual({ template: "app/views/posts/index.html.erb", via: "template", line: 6, column: 10 })
    expect(second[1]).toEqual({ template: "app/views/posts/index.html.erb", via: "template", line: 18, column: 4 })
  })

  test("falls back to the first node matching the template when node is absent", () => {
    const frames = buildRenderStack(COLLECTION_TREE, diagnostic({ location: { start: { line: 1, column: 1 } } }))

    expect(frames[1].line).toBe(6)
  })

  test("falls back to the template match when node names an unknown id", () => {
    const frames = buildRenderStack(COLLECTION_TREE, diagnostic({ node: "does-not-exist" }))

    expect(frames).toHaveLength(3)
    expect(frames[0].template).toBe("app/views/posts/_actions.html.erb")
  })

  test("returns a single frame when the template is not in the tree", () => {
    const frames = buildRenderStack(COLLECTION_TREE, diagnostic({
      template: "app/views/unknown.html.erb",
      location: { start: { line: 4, column: 2 } },
    }))

    expect(frames).toEqual([{ template: "app/views/unknown.html.erb", via: null, line: 4, column: 2 }])
  })

  test("omits the line when the diagnostic has no location", () => {
    const frames = buildRenderStack(COLLECTION_TREE, diagnostic({ node: "2" }))

    expect(frames[0]).toEqual({ template: "app/views/posts/_actions.html.erb", via: "partial", line: null, column: null })
  })

  test("stops at a cycle in the parent links", () => {
    const cyclic: RenderTreeNode[] = [
      { id: "a", template: "a.html.erb", parent: "b", via: "partial", location: { line: 1, column: 1 } },
      { id: "b", template: "b.html.erb", parent: "a", via: "partial", location: { line: 2, column: 1 } },
    ]

    const frames = buildRenderStack(cyclic, diagnostic({ template: "a.html.erb", node: "a" }))

    expect(frames).toHaveLength(2)
  })

  test("stops at a parent that names no node", () => {
    const dangling: RenderTreeNode[] = [
      { id: "a", template: "a.html.erb", parent: "ghost", via: "partial" },
    ]

    expect(buildRenderStack(dangling, diagnostic({ template: "a.html.erb", node: "a" }))).toHaveLength(1)
  })
})

describe("diagnosticKey", () => {
  test("collapses the same code on the same line of the same template", () => {
    const first = diagnostic({ code: "html-no-nested-forms", location: { start: { line: 3, column: 1 } } })
    const second = diagnostic({ code: "html-no-nested-forms", location: { start: { line: 3, column: 9 } } })

    expect(diagnosticKey(first)).toBe(diagnosticKey(second))
  })

  test("separates different lines, codes, and templates", () => {
    const base = diagnostic({ code: "a", location: { start: { line: 3, column: 1 } } })

    expect(diagnosticKey(base)).not.toBe(diagnosticKey(diagnostic({ code: "a", location: { start: { line: 4, column: 1 } } })))
    expect(diagnosticKey(base)).not.toBe(diagnosticKey(diagnostic({ code: "b", location: { start: { line: 3, column: 1 } } })))
    expect(diagnosticKey(base)).not.toBe(diagnosticKey(diagnostic({ template: "other.html.erb", code: "a", location: { start: { line: 3, column: 1 } } })))
  })

  test("separates codeless entries by message", () => {
    expect(diagnosticKey(diagnostic({ message: "one" }))).not.toBe(diagnosticKey(diagnostic({ message: "two" })))
  })
})

describe("readRuntimeReport", () => {
  test("reads the payload from the document", () => {
    const script = document.createElement("script")

    script.type = "application/json"
    script.setAttribute("data-herb-runtime-report", "")
    script.textContent = JSON.stringify({ version: 1, diagnostics: [{ template: "a.html.erb", message: "hi" }] })

    document.body.appendChild(script)

    expect(readRuntimeReport(document)!.diagnostics).toHaveLength(1)
  })

  test("returns null when the document carries no payload", () => {
    expect(readRuntimeReport(document)).toBeNull()
  })
})

describe("MAX_RUNTIME_DIAGNOSTICS", () => {
  test("is documented as 200", () => {
    expect(MAX_RUNTIME_DIAGNOSTICS).toBe(200)
  })
})
