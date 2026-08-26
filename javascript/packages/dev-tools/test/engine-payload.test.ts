import { describe, test, expect, beforeEach, vi } from "vitest"

import fixture from "./fixtures/engine-report.html?raw"

import { buildRenderStack, readRuntimeReport, resetRuntimeReportWarnings } from "../src/runtime/report"

import type { NormalizedRuntimeReport } from "../src/runtime/report"

function read(): NormalizedRuntimeReport {
  document.body.innerHTML = fixture

  const report = readRuntimeReport(document)

  expect(report).not.toBeNull()

  return report!
}

let warned: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetRuntimeReportWarnings()

  warned = vi.spyOn(console, "warn").mockImplementation(() => {})

  document.body.innerHTML = ""
})

describe("a payload written by Herb::Engine::Report", () => {
  test("is found by the tag the engine actually injects", () => {
    const report = read()

    expect(report.version).toBe(1)
    expect(warned).not.toHaveBeenCalled()
  })

  test("keeps the documentation link the engine spells snake_case", () => {
    const report = read()

    expect(report.diagnostics[0].docsUrl).toBe("https://herb-tools.dev/linter/rules/html-no-nested-forms")
  })

  test("carries every render tree position into the render stack", () => {
    const report = read()
    const stack = buildRenderStack(report.renderTree, report.diagnostics[0])

    expect(stack.map(frame => [frame.template, frame.line, frame.column])).toEqual([
      ["app/views/posts/_post.html.erb", 1, 1],
      ["app/views/posts/index.html.erb", 7, 11],
      ["app/views/layouts/application.html.erb", 15, 7],
    ])
  })

  test("loses none of the fields the engine sends", () => {
    const report = read()
    const [finding, metric] = report.diagnostics

    expect(report.renderTree).toHaveLength(3)
    expect(report.sources["app/views/posts/_post.html.erb"]).toBe("<form>\n  <form></form>\n</form>\n")

    expect(finding.code).toBe("html-no-nested-forms")
    expect(finding.severity).toBe("error")
    expect(finding.kind).toBe("diagnostic")
    expect(finding.origin).toBe("Herb Linter")
    expect(finding.suggestion).toBe("Remove the inner form.")
    expect(finding.location).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 38 } })

    expect(metric.kind).toBe("metric")
    expect(metric.value).toBe("3 SQL queries")
    expect(metric.severity).toBeNull()
    expect(metric.origin).toBe("Herb Engine Runtime")
  })

  test("survives the escaping the engine applies to the JSON", () => {
    const report = read()

    expect(fixture).toContain("\\u003c")
    expect(report.diagnostics[0].message).toBe("Nested `<form>` elements are not allowed.")
  })

  test("still accepts the camelCase spelling the JavaScript API uses", () => {
    document.body.innerHTML = `<script type="application/json" data-herb-diagnostics>${JSON.stringify({
      version: 1,
      diagnostics: [{ template: "a.html.erb", message: "m", docsUrl: "https://herb-tools.dev/x" }],
    })}</script>`

    expect(readRuntimeReport(document)!.diagnostics[0].docsUrl).toBe("https://herb-tools.dev/x")
  })
})
