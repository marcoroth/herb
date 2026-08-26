import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import fixture from "./fixtures/engine-report.html?raw"
import errorPage from "./fixtures/engine-error-page.html?raw"

import { buildRenderStack, readRuntimeReport, resetRuntimeReportWarnings } from "../src/runtime/report"
import { RuntimePanel } from "../src/runtime/panel"

import type { NormalizedRuntimeReport } from "../src/runtime/report"

function read(): NormalizedRuntimeReport {
  document.body.innerHTML = fixture

  const report = readRuntimeReport(document)

  expect(report).not.toBeNull()

  return report!
}

let warned: ReturnType<typeof vi.spyOn>
let panels: RuntimePanel[] = []

beforeEach(() => {
  resetRuntimeReportWarnings()

  warned = vi.spyOn(console, "warn").mockImplementation(() => {})

  document.body.innerHTML = ""
  panels = []
})

afterEach(() => {
  panels.forEach(panel => panel.destroy())

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

describe("the page Herb::Engine::Report::ErrorPage serves", () => {
  function boot() {
    document.documentElement.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const panel = new RuntimePanel()

    panels.push(panel)

    return panel
  }

  test("raises a blocking overlay with no JavaScript of its own", () => {
    const panel = boot()

    expect(panel.overlay).toBe("blocking")
    expect(document.querySelector(".herb-dev-tools-overlay-fullscreen")).not.toBeNull()
    expect(document.querySelector(".herb-dev-tools-close")).toBeNull()
  })

  test("carries the message, the location and the source the engine sent", () => {
    const panel = boot()

    panel.open()

    const card = document.querySelector(".herb-dev-tools-card")!

    expect(card.querySelector(".herb-dev-tools-code")!.textContent).toBe("missing-closing-tag")
    expect(card.querySelector(".herb-dev-tools-message")!.textContent)
      .toBe("Opening tag <form> does not have a matching closing tag.")
    expect(document.querySelector(".herb-dev-tools-summary")!.textContent)
      .toBe("app/views/posts/_post.html.erb:2:3")
  })

  test("says what is wrong before any of that runs", () => {
    document.documentElement.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const fallback = document.querySelector(".herb-error")!

    expect(fallback.querySelector("h1")!.textContent).toBe("This template could not be compiled")
    expect(fallback.textContent).toContain("does not have a matching closing tag")
    expect(fallback.querySelector("pre")!.textContent).toContain("<form>")
  })
})

describe("what the error page says about the run", () => {
  test("carries the Herb version and the visitors that ran", () => {
    document.body.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const report = readRuntimeReport(document)!

    expect(report.meta.herb_version).toMatch(/^\d+\.\d+\.\d+/)
    expect(report.meta.error_class).toBe("Herb::Engine::ParseError")
    expect(report.meta.visitors).toEqual([
      "Herb::Engine::Validators::SecurityValidator",
      "Herb::Engine::Validators::NestingValidator",
    ])
  })

  test("carries the parser options it was actually given", () => {
    document.body.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const report = readRuntimeReport(document)!

    expect(report.meta.parser_options).toEqual({ track_locations: "true", freeze: "false" })
  })

  test("prints the parser options on the blocking screen", () => {
    document.documentElement.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const panel = new RuntimePanel()

    panels.push(panel)

    const footer = document.querySelector(".herb-dev-tools-provenance")!

    expect(footer.textContent).toContain("track_locations: true")
  })

  test("prints it without any JavaScript too", () => {
    document.body.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const footer = document.querySelector(".herb-error-provenance")!

    expect(footer.textContent).toContain("Compiled by Herb")
    expect(footer.textContent).toContain("SecurityValidator")
  })

  test("shows it at the foot of the blocking screen", () => {
    document.documentElement.innerHTML = errorPage.replace(/^[\s\S]*?<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")

    const panel = new RuntimePanel()

    panels.push(panel)

    expect(panel.overlay).toBe("blocking")

    const footer = document.querySelector(".herb-dev-tools-provenance")!

    expect(footer).not.toBeNull()
    expect(footer.textContent).toContain("Compiled by Herb")
    expect(footer.textContent).toContain("Herb::Engine::Validators::NestingValidator")
  })

  test("says nothing about a run it was told nothing about", () => {
    document.body.innerHTML = fixture

    const panel = new RuntimePanel()

    panels.push(panel)
    panel.open()

    expect(readRuntimeReport(document)!.meta).toEqual({})
    expect(document.querySelector(".herb-dev-tools-provenance")).toBeNull()
  })
})
