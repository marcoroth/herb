import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import { stripAnsiColors } from "@herb-tools/highlighter"

import { RuntimePanel, inlineCodeHTML, safeUrl } from "../src/runtime/panel"
import { dropLeadingBlocks, resetRuntimeHighlighting } from "../src/runtime/highlighting"
import { MAX_RUNTIME_DIAGNOSTICS, resetRuntimeReportWarnings } from "../src/runtime/report"

import type { RuntimePanelOptions } from "../src/runtime/panel"
import type { RuntimeDiagnostic } from "../src/runtime/report"

const PAYLOAD = {
  version: 1,
  renderTree: [
    { id: "0", template: "app/views/layouts/application.html.erb", parent: null, via: "layout" },
    { id: "1", template: "app/views/posts/index.html.erb", parent: "0", via: "template", location: { line: 7, column: 10 } },
    { id: "2", template: "app/views/posts/_actions.html.erb", parent: "1", via: "partial", location: { line: 6, column: 10 } },
    { id: "3", template: "app/views/posts/_actions.html.erb", parent: "1", via: "partial", location: { line: 18, column: 4 } },
  ],
  diagnostics: [
    {
      template: "app/views/posts/_actions.html.erb",
      node: "2",
      message: "Nested `<form>` elements are not allowed.",
      code: "html-no-nested-forms",
      severity: "error",
      kind: "diagnostic",
      origin: "Herb Linter",
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 38 } },
      suggestion: "Remove the inner form.",
      docsUrl: "https://herb-tools.dev/linter/rules/html-no-nested-forms",
    },
    {
      template: "app/views/posts/index.html.erb",
      node: "1",
      message: "Image is missing an alt attribute.",
      code: "html-img-require-alt",
      severity: "warning",
      origin: "Acme Scanner",
      location: { start: { line: 3, column: 3 } },
    },
    {
      template: "app/views/posts/_actions.html.erb",
      node: "3",
      message: "This partial issued 3 SQL queries.",
      kind: "metric",
      origin: "Herb Engine Runtime",
      value: "3 SQL queries",
      location: { start: { line: 2, column: 1 } },
    },
  ],
}

const FIXABLE_SOURCE = `<div class="actions">\n  <form action="/posts" method="post">\n    <button>Delete</button>\n  </form>\n</div>\n`

const FIXED_SOURCE = `<div class="actions">\n  <button>Delete</button>\n</div>\n`

function fixPayload(fix: unknown, sources: Record<string, string> | null = { "app/views/posts/_actions.html.erb": FIXABLE_SOURCE }) {
  return {
    version: 1,
    diagnostics: [{
      template: "app/views/posts/_actions.html.erb",
      message: "Nested `<form>` elements are not allowed.",
      code: "html-no-nested-forms",
      severity: "error",
      origin: "Herb Linter",
      location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      fix,
    }],
    ...(sources === null ? {} : { sources }),
  }
}

async function waitFor<T>(read: () => T | null, what: string): Promise<T> {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const found = read()

    if (found !== null) {
      return found
    }

    await new Promise(resolve => setTimeout(resolve, 25))
  }

  throw new Error(`Timed out waiting for ${what}`)
}

function waitForFix() {
  return waitFor(() => document.querySelector(".herb-dev-tools-fix") as HTMLDetailsElement | null, "the fix diff to hydrate")
}

function plain(element: HTMLElement) {
  return stripAnsiColors(element.textContent ?? "")
}

function waitForExcerpt() {
  return waitFor(() => document.querySelector(".herb-dev-tools-excerpt herb-ansi") as HTMLElement | null, "the excerpt to hydrate")
}

let panels: RuntimePanel[] = []

function embed(payload: unknown) {
  const script = document.createElement("script")

  script.type = "application/json"
  script.setAttribute("data-herb-diagnostics", "")
  script.textContent = typeof payload === "string" ? payload : JSON.stringify(payload)

  document.body.appendChild(script)
}

function createPanel(options: RuntimePanelOptions = {}) {
  const panel = new RuntimePanel(options)

  panels.push(panel)

  return panel
}

function root() {
  return document.querySelector(".herb-dev-tools-runtime-root") as HTMLElement | null
}

function cards() {
  return Array.from(document.querySelectorAll(".herb-dev-tools-card"))
}

function badge() {
  return document.querySelector(".herb-dev-tools-badge") as HTMLElement | null
}

function badgeGlyph() {
  return document.querySelector(".herb-dev-tools-badge-glyph")!.textContent
}

function badgeCount() {
  return document.querySelector(".herb-dev-tools-badge-count")!.textContent
}

function badgeTone() {
  return badge()!.getAttribute("data-herb-dev-tools-tone")
}

function badgeBorder() {
  return getComputedStyle(badge()!).borderTopColor
}

function diagnostic(overrides: Partial<RuntimeDiagnostic> = {}): RuntimeDiagnostic {
  return {
    template: "app/views/posts/_actions.html.erb",
    message: "Nested `<form>` elements are not allowed.",
    ...overrides,
  }
}

beforeEach(() => {
  resetRuntimeReportWarnings()
  sessionStorage.clear()

  document.body.innerHTML = ""
  panels = []
})

afterEach(() => {
  panels.forEach(panel => panel.destroy())

  vi.restoreAllMocks()

  document.body.innerHTML = ""
  sessionStorage.clear()
})

describe("clear control", () => {
  function clearButton() {
    return document.querySelector(".herb-dev-tools-clear") as HTMLButtonElement | null
  }

  function chip(origin: string) {
    return document.querySelector(`.herb-dev-tools-filter[data-herb-dev-tools-origin="${origin}"]`) as HTMLElement
  }

  test("sits with the hide button and not in the window controls", () => {
    embed(PAYLOAD)
    createPanel().open()

    const header = document.querySelector(".herb-dev-tools-header")!

    expect(clearButton()!.parentElement).toBe(header)
    expect(clearButton()!.nextElementSibling!.className).toBe("herb-dev-tools-hide")
    expect(header.querySelector(".herb-dev-tools-window-controls")!.contains(clearButton())).toBe(false)
  })

  test("empties everything while the All filter is active", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(3)
    expect(clearButton()!.textContent).toBe("Clear all")

    clearButton()!.click()

    expect(cards()).toHaveLength(0)
    expect(panel.count).toBe(0)
  })

  test("clears only the filtered origin and leaves the rest", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    chip("Herb Linter").click()

    expect(clearButton()!.textContent).toBe("Clear Herb Linter")

    clearButton()!.click()

    const origins = cards().map(card => card.getAttribute("data-herb-dev-tools-origin"))

    expect(origins).toEqual(["Acme Scanner", "Herb Engine Runtime"])
    expect(panel.count).toBe(2)
  })

  test("names its scope for assistive technology", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()

    expect(clearButton()!.getAttribute("aria-label")).toBe("Clear all 3 entries and empty the panel")

    chip("Herb Linter").click()

    expect(clearButton()!.getAttribute("aria-label")).toBe("Clear the 1 entry from Herb Linter")
  })

  test("leaves the dismissed state alone", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()

    expect(panel.dismissed).toBe(false)

    clearButton()!.click()

    expect(panel.dismissed).toBe(false)
    expect(JSON.parse(sessionStorage.getItem("herb-dev-tools-runtime-panel")!).dismissed).toBe(false)
  })

  test("closes the panel when the control empties it", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    clearButton()!.click()

    expect(panel.count).toBe(0)
    expect(root()).toBeNull()
    expect(panel.dismissed).toBe(false)
  })

  test("stays open when the control only clears one origin", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    ;(document.querySelector('[data-herb-dev-tools-origin="Herb Linter"]') as HTMLButtonElement).click()
    clearButton()!.click()

    expect(root()).not.toBeNull()
    expect(panel.count).toBe(2)
  })

  test("still explains itself when the API empties it", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    panel.clear()

    expect(root()).not.toBeNull()
    expect(document.querySelector(".herb-dev-tools-empty")!.textContent)
      .toBe("Cleared. Reload the page to read its report again, and send anything reported from JavaScript again.")
    expect(clearButton()).toBeNull()
  })

  test("goes away once the panel is closed after a clear", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    clearButton()!.click()
    panel.close()

    expect(root()).toBeNull()
  })

  test("comes back when something is reported after a clear", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    clearButton()!.click()

    panel.report(diagnostic({ origin: "Herb Linter", code: "fresh" }))

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-empty")).toBeNull()
  })
})

describe("stylesheet", () => {
  test("carries its own stylesheet and takes it away again", () => {
    expect(document.querySelectorAll('style[data-herb-dev-tools="runtime-panel"]')).toHaveLength(0)

    const panel = createPanel()

    expect(document.querySelectorAll('style[data-herb-dev-tools="runtime-panel"]')).toHaveLength(1)

    panel.destroy()

    expect(document.querySelectorAll('style[data-herb-dev-tools="runtime-panel"]')).toHaveLength(0)
  })
})

describe("badge", () => {
  test("docks a badge carrying the diagnostic count", () => {
    embed(PAYLOAD)
    createPanel()

    const badge = root()!.querySelector(".herb-dev-tools-badge") as HTMLElement

    expect(badge).not.toBeNull()
    expect(badge.querySelector(".herb-dev-tools-badge-count")!.textContent).toBe("2")
    expect(badge.textContent).toContain("⛔")
  })

  test("takes its glyph and colour from the worst severity present", () => {
    const panel = createPanel()

    panel.report(diagnostic({ severity: "warning", code: "one" }))

    expect(badgeGlyph()).toBe("⚠️")
    expect(badgeTone()).toBe("warning")
    expect(badgeBorder()).toBe("rgb(245, 158, 11)")

    panel.report(diagnostic({ severity: "error", code: "two" }))

    expect(badgeGlyph()).toBe("⛔")
    expect(badgeTone()).toBe("error")
    expect(badgeBorder()).toBe("rgb(220, 38, 38)")
  })

  test("reads as information when nothing worse than a notice is present", () => {
    const panel = createPanel()

    panel.report(diagnostic({ severity: "info", code: "one" }))

    expect(badgeGlyph()).toBe("ℹ️")
    expect(badgeTone()).toBe("info")
    expect(badgeBorder()).toBe("rgb(59, 130, 246)")

    panel.clear()
    panel.report(diagnostic({ severity: "hint", code: "two" }))

    expect(badgeGlyph()).toBe("ℹ️")
    expect(badgeTone()).toBe("hint")
    expect(badgeBorder()).toBe("rgb(16, 185, 129)")
  })

  test("counts the metrics instead of reading as a warning over zero problems", () => {
    const panel = createPanel()

    panel.report(diagnostic({ kind: "metric", value: "3 SQL queries", code: "one" }))
    panel.report(diagnostic({ kind: "metric", value: "2 partials", code: "two" }))

    expect(badgeGlyph()).toBe("📊")
    expect(badgeTone()).toBe("metric")
    expect(badgeBorder()).toBe("rgb(156, 163, 175)")
    expect(badgeCount()).toBe("2")
  })

  test("names the severity and the count for assistive technology", () => {
    const panel = createPanel()

    panel.report(diagnostic({ severity: "warning", code: "one" }))

    expect(badge()!.getAttribute("aria-label")).toBe("1 warning")
    expect(badge()!.querySelector(".herb-dev-tools-badge-glyph")!.getAttribute("aria-hidden")).toBe("true")

    panel.report(diagnostic({ severity: "error", code: "two" }))

    expect(badge()!.getAttribute("aria-label")).toBe("1 error, 1 warning")

    panel.clear()
    panel.report(diagnostic({ kind: "metric", value: "3 SQL queries", code: "three" }))

    expect(badge()!.getAttribute("aria-label")).toBe("1 metric")
  })

  test("does not render without a payload or a reported entry", () => {
    createPanel()

    expect(root()).toBeNull()
  })

  test("stays out of the way of the page", () => {
    embed(PAYLOAD)
    createPanel()

    const styles = getComputedStyle(root()!)

    expect(getComputedStyle(document.body).overflow).not.toBe("hidden")
    expect(document.querySelectorAll(".herb-dev-tools-runtime-root")).toHaveLength(1)
    expect(styles.position).toBe("fixed")
    expect(styles.pointerEvents).toBe("none")
    expect(root()!.getBoundingClientRect().width).toBeLessThan(window.innerWidth)
  })

  test("opens and closes the panel on click", () => {
    embed(PAYLOAD)
    createPanel()

    expect(document.querySelector(".herb-dev-tools-panel.herb-dev-tools-open")).toBeNull()

    ;(root()!.querySelector('[data-herb-dev-tools-action="toggle"]') as HTMLElement).click()

    expect(document.querySelector(".herb-dev-tools-panel.herb-dev-tools-open")).not.toBeNull()

    ;(root()!.querySelector('[data-herb-dev-tools-action="toggle"]') as HTMLElement).click()

    expect(document.querySelector(".herb-dev-tools-panel.herb-dev-tools-open")).toBeNull()
  })

  test("persists the open state in sessionStorage", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    panel.destroy()

    createPanel()

    expect(document.querySelector(".herb-dev-tools-panel.herb-dev-tools-open")).not.toBeNull()
  })

  test("stays dismissed across a re-initialization", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.dismiss()

    expect(root()).toBeNull()

    panel.destroy()
    createPanel()

    expect(root()).toBeNull()
  })
})

describe("cards", () => {
  test("groups cards by template", () => {
    embed(PAYLOAD)
    createPanel()

    const titles = Array.from(document.querySelectorAll(".herb-dev-tools-group-title")).map(node => node.textContent)

    expect(titles[0]).toContain("app/views/posts/_actions.html.erb")
    expect(titles[1]).toContain("app/views/posts/index.html.erb")
    expect(cards()).toHaveLength(3)
  })

  test("renders a severity dot, the rule code, and the suggestion", () => {
    embed(PAYLOAD)
    createPanel()

    const card = cards()[0]

    expect(card.querySelector(".herb-dev-tools-dot-error")).not.toBeNull()
    expect(card.querySelector(".herb-dev-tools-code")!.textContent).toBe("html-no-nested-forms")
    expect(card.querySelector(".herb-dev-tools-code")!.getAttribute("href")).toBeNull()
    expect(card.querySelector(".herb-dev-tools-docs")!.getAttribute("href")).toBe("https://herb-tools.dev/linter/rules/html-no-nested-forms")
    expect(card.querySelector(".herb-dev-tools-suggestion")!.textContent).toBe("Remove the inner form.")
  })

  test("never renders a severity dot for a metric", () => {
    embed(PAYLOAD)
    createPanel()

    const metric = document.querySelector('.herb-dev-tools-card[data-herb-dev-tools-kind="metric"]') as HTMLElement

    expect(metric).not.toBeNull()
    expect(metric.querySelector(".herb-dev-tools-dot")).toBeNull()
    expect(metric.querySelector(".herb-dev-tools-metric")!.textContent).toBe("3 SQL queries")
    expect(document.querySelectorAll(".herb-dev-tools-dot-error, .herb-dev-tools-dot-warning")).toHaveLength(2)
  })

  test("keeps a metric free of a severity dot even when the payload sends one", () => {
    embed({ version: 1, diagnostics: [{ template: "a.html.erb", message: "m", kind: "metric", severity: "error" }] })
    createPanel()

    expect(document.querySelector(".herb-dev-tools-dot")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-metric")!.textContent).toBe("metric")
  })

  test("renders the render stack innermost first", () => {
    embed(PAYLOAD)
    createPanel()

    const frames = Array.from(cards()[0].querySelectorAll(".herb-dev-tools-frame-target")).map(node => node.textContent)

    expect(frames).toEqual([
      "app/views/posts/_actions.html.erb:1:1",
      "app/views/posts/index.html.erb:6:10",
      "app/views/layouts/application.html.erb:7:10",
    ])

    expect(cards()[0].querySelector(".herb-dev-tools-stack-order")!.textContent).toBe("innermost first")
  })

  test("attributes the second collection occurrence to its own call site", () => {
    embed(PAYLOAD)
    createPanel()

    const metric = document.querySelector('.herb-dev-tools-card[data-herb-dev-tools-kind="metric"]') as HTMLElement
    const frames = Array.from(metric.querySelectorAll(".herb-dev-tools-frame-target")).map(node => node.textContent)

    expect(frames[1]).toBe("app/views/posts/index.html.erb:18:4")
  })

  test("renders without an excerpt when the source is unavailable", () => {
    embed(PAYLOAD)
    createPanel()

    expect(document.querySelector(".herb-dev-tools-excerpt")).toBeNull()
  })

  test("renders nothing for a payload with zero diagnostics", () => {
    embed({ version: 1, diagnostics: [] })
    createPanel()

    expect(root()).toBeNull()
  })

  test("survives a malformed payload without rendering chrome", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})

    embed("{ not json at all")

    expect(() => createPanel()).not.toThrow()
    expect(root()).toBeNull()
  })

  test("escapes untrusted payload values", () => {
    embed({
      version: 1,
      diagnostics: [{
        template: "<img src=x onerror=alert(1)>.html.erb",
        message: "<script>alert('message')</script>",
        code: "\"><b>code</b>",
        suggestion: "<i>suggestion</i>",
        origin: "<u>origin</u>",
      }],
    })

    createPanel()

    expect(document.querySelector(".herb-dev-tools-body img")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-body script")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-body b")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-body i")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-message")!.textContent).toBe("<script>alert('message')</script>")
    expect(document.querySelector(".herb-dev-tools-group-title")!.textContent).toContain("<img src=x onerror=alert(1)>.html.erb")
  })

  test("refuses to link a non-http docsUrl", () => {
    embed({
      version: 1,
      diagnostics: [{ template: "a.html.erb", message: "m", code: "rule", docsUrl: "javascript:alert(1)" }],
    })

    createPanel()

    const code = document.querySelector(".herb-dev-tools-code")!

    expect(code.tagName).toBe("SPAN")
    expect(code.getAttribute("href")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-docs")).toBeNull()
  })
})

describe("safeUrl", () => {
  test("allows http, https and file", () => {
    expect(safeUrl("http://herb-tools.dev")).toBe("http://herb-tools.dev")
    expect(safeUrl("https://herb-tools.dev")).toBe("https://herb-tools.dev")
    expect(safeUrl("file:///tmp/rules.html")).toBe("file:///tmp/rules.html")
  })

  test("matches the scheme case-insensitively", () => {
    expect(safeUrl("HTTPS://herb-tools.dev")).toBe("HTTPS://herb-tools.dev")
    expect(safeUrl("FiLe:///tmp/rules.html")).toBe("FiLe:///tmp/rules.html")
  })

  test("refuses every other scheme, including protocol relative", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull()
    expect(safeUrl("JavaScript:alert(1)")).toBeNull()
    expect(safeUrl("data:text/html,<b>x</b>")).toBeNull()
    expect(safeUrl("//herb-tools.dev")).toBeNull()
    expect(safeUrl("/linter/rules")).toBeNull()
    expect(safeUrl(null)).toBeNull()
  })
})

describe("inline code", () => {
  test("escapes markup before turning backticks into code", () => {
    expect(inlineCodeHTML("Avoid `<img onerror=alert(1)>` here"))
      .toBe('Avoid <code class="herb-dev-tools-inline-code">&lt;img onerror=alert(1)&gt;</code> here')
  })

  test("leaves an unpaired backtick alone", () => {
    expect(inlineCodeHTML("a ` b")).toBe("a ` b")
  })
})

describe("dropLeadingBlocks", () => {
  const listing = "  1 | <div>\n  2 | </div>"

  test("drops the header and path blocks a diagnostic render emits", () => {
    expect(dropLeadingBlocks(`[error] boom (rule)\n\na.html.erb:1:1\n\n${listing}`, 2)).toBe(listing)
  })

  test("drops only the path block a file or diff render emits", () => {
    expect(dropLeadingBlocks(`a.html.erb\n\n${listing}`, 1)).toBe(listing)
  })

  test("keeps blank line runs inside the listing", () => {
    expect(dropLeadingBlocks(`a.html.erb\n\n${listing}\n\ntail`, 1)).toBe(`${listing}\n\ntail`)
  })

  test("returns the input untouched when there is nothing to drop", () => {
    expect(dropLeadingBlocks(listing, 2)).toBe(listing)
  })

  test("returns null for blank output", () => {
    expect(dropLeadingBlocks("", 1)).toBeNull()
    expect(dropLeadingBlocks("   \n  ", 1)).toBeNull()
  })
})

describe("excerpts", () => {
  test("renders the marked excerpt into a herb-ansi element", async () => {
    embed({
      version: 1,
      sources: { "app/views/posts/_actions.html.erb": FIXABLE_SOURCE },
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        code: "html-no-nested-forms",
        severity: "error",
        origin: "Herb Linter",
        location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      }],
    })

    const panel = createPanel()

    panel.open()

    expect(document.querySelector("[data-herb-dev-tools-excerpt-pending]")).not.toBeNull()

    const element = await waitForExcerpt()

    expect(document.querySelector("[data-herb-dev-tools-excerpt-pending]")).toBeNull()
    expect(plain(element)).toContain("\u2502")
    expect(plain(element)).toContain('<form action="/posts"')
    expect(plain(element)).toContain("~~~")
    expect(plain(element)).not.toContain("Nested `<form>`")
    expect(plain(element)).not.toContain("html-no-nested-forms")
    expect(element.shadowRoot!.querySelectorAll("span").length).toBeGreaterThan(0)
  })

  test("keeps template source out of the panel markup", async () => {
    embed({
      version: 1,
      sources: { "a.html.erb": `<img src="x" onerror="alert(1)">\n<b>bold</b>\n` },
      diagnostics: [{
        template: "a.html.erb",
        message: "m",
        severity: "error",
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
      }],
    })

    const panel = createPanel()

    panel.open()

    const element = await waitForExcerpt()

    expect(plain(element)).toContain("<img")
    expect(document.querySelector(".herb-dev-tools-excerpt img")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-excerpt b")).toBeNull()
    expect(element.shadowRoot!.querySelector("img")).toBeNull()
  })

  test("focuses without marking for a metric", async () => {
    embed({
      version: 1,
      sources: { "a.html.erb": FIXABLE_SOURCE },
      diagnostics: [{
        template: "a.html.erb",
        message: "This partial issued 3 SQL queries.",
        kind: "metric",
        value: "3 SQL queries",
        origin: "Herb Engine Runtime",
        location: { start: { line: 2, column: 1 } },
      }],
    })

    const panel = createPanel()

    panel.open()

    const element = await waitForExcerpt()

    expect(plain(element)).toContain("\u2192")
    expect(plain(element)).not.toContain("~~~")
  })

  test("paints a themed surface behind the excerpt", async () => {
    embed({
      version: 1,
      sources: { "a.html.erb": FIXABLE_SOURCE },
      diagnostics: [{
        template: "a.html.erb",
        message: "m",
        severity: "error",
        location: { start: { line: 2, column: 3 }, end: { line: 2, column: 8 } },
      }],
    })

    const panel = createPanel()

    panel.open()

    const element = await waitForExcerpt()
    const surface = getComputedStyle(element)

    expect(surface.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(surface.color).not.toBe(surface.backgroundColor)
  })
})

describe("excerpt line numbers", () => {
  function embedMarked() {
    embed({
      version: 1,
      sources: { "app/views/posts/_actions.html.erb": FIXABLE_SOURCE },
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        code: "html-no-nested-forms",
        severity: "error",
        origin: "Herb Linter",
        location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      }],
    })
  }

  test("links the marked line number when a handler is provided", async () => {
    embedMarked()

    createPanel({ onOpenFile: () => {} }).open()

    const element = await waitForExcerpt()
    const link = element.shadowRoot!.querySelector("a")

    expect(link).not.toBeNull()
    expect(link!.textContent).toBe("2")
    expect(link!.getAttribute("href")).toBe("file:///app/views/posts/_actions.html.erb")
  })

  test("opens the template in the editor when the marked line number is clicked", async () => {
    embedMarked()

    const opened: Array<[string, number, number]> = []

    createPanel({ onOpenFile: (file, line, column) => opened.push([file, line, column]) }).open()

    const element = await waitForExcerpt()

    element.shadowRoot!.querySelector("a")!.click()

    expect(opened).toEqual([["app/views/posts/_actions.html.erb", 2, 3]])
  })

  test("leaves the line number unlinked without a handler", async () => {
    embedMarked()

    createPanel().open()

    const element = await waitForExcerpt()

    expect(element.shadowRoot!.querySelector("a")).toBeNull()
  })

  test("keeps the file header out of the excerpt either way", async () => {
    embedMarked()

    createPanel({ onOpenFile: () => {} }).open()

    const element = await waitForExcerpt()

    expect(element.shadowRoot!.textContent).not.toContain("app/views/posts/_actions.html.erb")
  })
})

describe("fix diffs", () => {
  test("renders a safe fix as a collapsed diff that says it was not applied", async () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()
    const summary = details.querySelector(".herb-dev-tools-fix-summary")!

    expect(details.tagName).toBe("DETAILS")
    expect(details.open).toBe(false)
    expect(details.getAttribute("data-herb-dev-tools-fix")).toBe("safe")
    expect(summary.textContent).toContain("Not applied")
    expect(summary.querySelector(".herb-dev-tools-fix-command")!.textContent).toBe("herb lint --fix")
    expect(summary.textContent).not.toContain("unsafe")

    const rendered = details.querySelector(".herb-dev-tools-fix-diff herb-ansi") as HTMLElement

    expect(rendered).not.toBeNull()
    expect(plain(rendered)).toContain("- ")
    expect(plain(rendered)).toContain("+ ")
    expect(plain(rendered)).toContain('<form action="/posts"')
  })

  test("labels an unsafe fix differently", async () => {
    embed(fixPayload({ kind: "unsafe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()
    const summary = details.querySelector(".herb-dev-tools-fix-summary")!

    expect(details.getAttribute("data-herb-dev-tools-fix")).toBe("unsafe")
    expect(summary.textContent).toContain("Not applied")
    expect(summary.textContent).toContain("unsafe")
    expect(summary.querySelector(".herb-dev-tools-fix-command")!.textContent).toBe("herb lint --fix-unsafely")
  })

  test("falls back to a safe label for an unrecognized kind", async () => {
    embed(fixPayload({ kind: "reckless", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()

    expect(details.getAttribute("data-herb-dev-tools-fix")).toBe("safe")
    expect(details.querySelector(".herb-dev-tools-fix-command")!.textContent).toBe("herb lint --fix")
  })

  test("gives the diff a foreground that differs from its background", async () => {
    embed(fixPayload({ source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()

    details.open = true

    const rendered = details.querySelector(".herb-dev-tools-fix-diff herb-ansi") as HTMLElement
    const surface = getComputedStyle(rendered)

    expect(surface.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(surface.color).not.toBe(surface.backgroundColor)

    const span = rendered.shadowRoot!.querySelector("span") as HTMLElement

    expect(span).not.toBeNull()
    expect(getComputedStyle(span).color).not.toBe(surface.backgroundColor)
  })

  test("drops a fix without a string source", () => {
    embed(fixPayload({ kind: "safe" }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-fix")).toBeNull()
    expect(document.querySelector("[data-herb-dev-tools-fix-pending]")).toBeNull()
  })

  test("drops a fix whose source is what the template already says", () => {
    embed(fixPayload({ kind: "safe", source: FIXABLE_SOURCE }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-fix")).toBeNull()
    expect(document.querySelector("[data-herb-dev-tools-fix-pending]")).toBeNull()
  })

  test("renders the rest of the card when the template has no source", () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }, null))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-message")!.textContent).toBe("Nested <form> elements are not allowed.")
    expect(document.querySelectorAll(".herb-dev-tools-frame")).not.toHaveLength(0)
    expect(document.querySelector(".herb-dev-tools-fix")).toBeNull()
    expect(document.querySelector("[data-herb-dev-tools-fix-pending]")).toBeNull()
  })

  test("renders the card before the backend resolves and fills the diff in afterwards", async () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-badge-count")!.textContent).toBe("1")
    expect(document.querySelector(".herb-dev-tools-fix")).toBeNull()
    expect(document.querySelector("[data-herb-dev-tools-fix-pending]")).not.toBeNull()

    await waitForFix()

    expect(document.querySelector("[data-herb-dev-tools-fix-pending]")).toBeNull()
  })
})

describe("expanded presentation", () => {
  function expandButton() {
    return document.querySelector('[data-herb-dev-tools-action="expand"]') as HTMLButtonElement
  }

  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement
  }

  test("keeps severity out of the header band", () => {
    const instance = createPanel()

    instance.report(diagnostic({ severity: "error", code: "one" }))
    instance.open()

    const header = document.querySelector(".herb-dev-tools-header") as HTMLElement
    const title = document.querySelector(".herb-dev-tools-title") as HTMLElement

    const neutral = {
      band: getComputedStyle(header).backgroundColor,
      border: getComputedStyle(header).borderBottomColor,
      title: getComputedStyle(title).color,
    }

    expect(neutral.band).toBe("rgb(249, 250, 251)")
    expect(neutral.border).toBe("rgb(229, 231, 235)")
    expect(neutral.title).toBe("rgb(17, 24, 39)")

    instance.clear()
    instance.report(diagnostic({ kind: "metric", value: "3 SQL queries", code: "two" }))

    const after = document.querySelector(".herb-dev-tools-header") as HTMLElement

    expect(getComputedStyle(after).backgroundColor).toBe(neutral.band)
    expect(getComputedStyle(document.querySelector(".herb-dev-tools-title") as HTMLElement).color).toBe(neutral.title)
  })

  test("sits beside the close button as the last pair in the header", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    const header = document.querySelector(".herb-dev-tools-header")!
    const cluster = header.querySelector(".herb-dev-tools-window-controls")!

    expect(cluster).toBe(header.lastElementChild)
    expect(Array.from(cluster.children).map(node => node.getAttribute("data-herb-dev-tools-action")))
      .toEqual(["expand", "close"])

    expect(header.querySelector(".herb-dev-tools-hide")!.parentElement).toBe(header)
  })

  test("matches the close button's hit target and optical weight", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    const expand = expandButton().getBoundingClientRect()
    const close = (document.querySelector(".herb-dev-tools-close") as HTMLElement).getBoundingClientRect()

    expect(expand.width).toBe(close.width)
    expect(expand.height).toBe(close.height)
    expect(expand.width).toBeGreaterThanOrEqual(24)
    expect(parseFloat(getComputedStyle(expandButton()).fontSize)).toBeGreaterThan(15)
  })

  test("keeps every control reachable in the anchored header", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "560px"

    const headerElement = document.querySelector(".herb-dev-tools-header") as HTMLElement
    const header = headerElement.getBoundingClientRect()
    const close = document.querySelector(".herb-dev-tools-close")!.getBoundingClientRect()

    expect(headerElement.scrollWidth).toBeLessThanOrEqual(headerElement.clientWidth)
    expect(close.right).toBeLessThanOrEqual(header.right + 1)

    for (const control of Array.from(headerElement.querySelectorAll("button"))) {
      const box = control.getBoundingClientRect()

      expect(box.left).toBeGreaterThanOrEqual(header.left)
      expect(box.right).toBeLessThanOrEqual(header.right + 1)
    }
  })

  test("spends the header's width on controls, not on counts", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    expect(document.querySelector(".herb-dev-tools-summary")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-clear")).not.toBeNull()
    expect(document.querySelector(".herb-dev-tools-hide")).not.toBeNull()

    instance.expand()

    expect(document.querySelector(".herb-dev-tools-summary")).toBeNull()
  })

  test("leaves the counts to the filter chips and the badge", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    const badge = document.querySelector(".herb-dev-tools-badge") as HTMLElement

    expect(badge.title).toBe("1 error, 1 warning, 1 metric")

    const chips = Array.from(document.querySelectorAll(".herb-dev-tools-filter")).map(node => node.textContent)

    expect(chips).toContain("All (3)")
    expect(chips.every(label => /\(\d+\)$/.test(label!))).toBe(true)
  })

  test("still counts what a focused overlay shows, where there are no chips", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", origin: "Herb Parser", overlay: "blocking" }),
      diagnostic({ code: "two", origin: "Herb Validator", overlay: "blocking" }),
    ])

    expect(document.querySelector(".herb-dev-tools-filters")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-summary")!.textContent).toBe("2 errors")
  })

  test("gives the action labels away before the controls when the panel is narrow", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "360px"

    const headerElement = document.querySelector(".herb-dev-tools-header") as HTMLElement

    expect(headerElement.scrollWidth).toBeLessThanOrEqual(headerElement.clientWidth)

    const close = document.querySelector(".herb-dev-tools-close")!.getBoundingClientRect()
    const expand = document.querySelector(".herb-dev-tools-expand")!.getBoundingClientRect()
    const clear = document.querySelector(".herb-dev-tools-clear")!.getBoundingClientRect()
    const title = document.querySelector(".herb-dev-tools-title")!.getBoundingClientRect()

    expect(close.width).toBe(26)
    expect(expand.width).toBe(26)
    expect(clear.width).toBeGreaterThan(0)
    expect(title.width).toBeGreaterThan(0)
  })

  test("toggles the expanded surface on and off", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    expect(panel().classList.contains("herb-dev-tools-expanded")).toBe(false)
    expect(document.querySelector(".herb-dev-tools-backdrop")).toBeNull()

    expandButton().click()

    expect(instance.expanded).toBe(true)
    expect(panel().classList.contains("herb-dev-tools-expanded")).toBe(true)
    expect(document.querySelector(".herb-dev-tools-backdrop")).not.toBeNull()

    expandButton().click()

    expect(instance.expanded).toBe(false)
    expect(panel().classList.contains("herb-dev-tools-expanded")).toBe(false)
    expect(document.querySelector(".herb-dev-tools-backdrop")).toBeNull()
  })

  test("names the control after what the click will do", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    expect(expandButton().getAttribute("aria-label")).toBe("Expand panel to fill the window")
    expect(expandButton().getAttribute("aria-expanded")).toBe("false")

    instance.expand()

    expect(expandButton().getAttribute("aria-label")).toBe("Collapse panel back to the corner")
    expect(expandButton().getAttribute("aria-expanded")).toBe("true")
  })

  test("survives a reload through sessionStorage", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()
    instance.destroy()

    const reloaded = createPanel()

    expect(reloaded.expanded).toBe(true)
    expect(panel().classList.contains("herb-dev-tools-expanded")).toBe(true)
  })

  test("fills the window minus the inset when expanded", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    const rect = panel().getBoundingClientRect()

    expect(rect.left).toBeCloseTo(24, 0)
    expect(rect.top).toBeCloseTo(24, 0)
    expect(rect.width).toBeCloseTo(window.innerWidth - 48, 0)
    expect(rect.height).toBeCloseTo(window.innerHeight - 48, 0)
  })

  test("collapses back to the exact anchored position with the panel still open", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()

    const anchored = panel().getBoundingClientRect().toJSON()

    instance.expand()

    expect(panel().getBoundingClientRect().toJSON()).not.toEqual(anchored)

    instance.collapse()

    expect(panel().getBoundingClientRect().toJSON()).toEqual(anchored)
    expect(panel().classList.contains("herb-dev-tools-open")).toBe(true)
    expect(getComputedStyle(panel()).display).not.toBe("none")
  })

  test("collapses when the backdrop is clicked", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    ;(document.querySelector(".herb-dev-tools-backdrop") as HTMLElement).click()

    expect(instance.expanded).toBe(false)
  })

  test("closes on Escape, the way the close button does, and stops listening", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(document.querySelector(".herb-dev-tools-panel.herb-dev-tools-open")).toBeNull()
    expect(badge()).not.toBeNull()
    expect(instance.dismissed).toBe(false)

    const remove = vi.spyOn(document, "removeEventListener")

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(remove).not.toHaveBeenCalledWith("keydown", expect.anything())
  })

  test("leaves Escape and the close button in the same place", () => {
    embed(PAYLOAD)

    const escaped = createPanel()

    escaped.open()
    escaped.expand()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    const afterEscape = { open: escaped.element?.querySelector(".herb-dev-tools-open") ?? null, expanded: escaped.expanded, dismissed: escaped.dismissed }

    escaped.destroy()
    document.body.innerHTML = ""
    embed(PAYLOAD)

    const clicked = createPanel()

    clicked.open()
    clicked.expand()
    ;(document.querySelector('[data-herb-dev-tools-action="close"]') as HTMLButtonElement).click()

    expect({ open: clicked.element?.querySelector(".herb-dev-tools-open") ?? null, expanded: clicked.expanded, dismissed: clicked.dismissed })
      .toEqual(afterEscape)
  })

  test("releases the Escape listener on destroy", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    const remove = vi.spyOn(document, "removeEventListener")

    instance.destroy()

    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function))
  })

  test("never scroll locks the host page", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    expect(getComputedStyle(document.body).overflow).not.toBe("hidden")
    expect(getComputedStyle(document.documentElement).overflow).not.toBe("hidden")
    expect(document.body.style.position).not.toBe("fixed")
  })

  test("keeps each card whole when the cards flow into columns", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    const card = document.querySelector(".herb-dev-tools-card") as HTMLElement
    const stack = card.querySelector(".herb-dev-tools-stack") as HTMLElement

    expect(stack).not.toBeNull()

    const cardRect = card.getBoundingClientRect()
    const stackRect = stack.getBoundingClientRect()

    expect(stackRect.left).toBeGreaterThanOrEqual(cardRect.left - 1)
    expect(stackRect.right).toBeLessThanOrEqual(cardRect.right + 1)
  })
})

describe("filters", () => {
  test("offers one filter per origin plus an all filter", () => {
    embed(PAYLOAD)
    createPanel()

    const labels = Array.from(document.querySelectorAll("[data-herb-dev-tools-origin].herb-dev-tools-filter"))
      .map(node => node.textContent)

    expect(labels).toEqual(["All (3)", "Herb Linter (1)", "Acme Scanner (1)", "Herb Engine Runtime (1)"])
  })

  test("shows the origin exactly as the producer wrote it", () => {
    embed(PAYLOAD)
    createPanel()

    const linter = document.querySelector('.herb-dev-tools-filter[data-herb-dev-tools-origin="Herb Linter"]')!

    expect(linter.textContent).toBe("Herb Linter (1)")

    const card = cards()[0]

    expect(card.getAttribute("data-herb-dev-tools-origin")).toBe("Herb Linter")
    expect(card.querySelector(".herb-dev-tools-origin")!.textContent).toBe("Herb Linter")
  })

  test("carries a name of its own through untouched", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Acme Scanner" }))

    const card = cards()[0]

    expect(card.getAttribute("data-herb-dev-tools-origin")).toBe("Acme Scanner")
    expect(card.querySelector(".herb-dev-tools-origin")!.textContent).toBe("Acme Scanner")
  })

  test("keeps two spellings of the same producer apart", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Herb Linter", code: "one" }))
    panel.report(diagnostic({ origin: "herb-linter", code: "two" }))

    const filters = Array.from(document.querySelectorAll(".herb-dev-tools-filter"))

    expect(filters.map(node => node.textContent)).toEqual(["All (2)", "Herb Linter (1)", "herb-linter (1)"])
  })

  test("trims surrounding whitespace so a stray space does not split the chip", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Herb Linter", code: "one" }))
    panel.report(diagnostic({ origin: "Herb Linter ", code: "two" }))
    panel.report(diagnostic({ origin: "  Herb Linter  ", code: "three" }))

    const filters = Array.from(document.querySelectorAll(".herb-dev-tools-filter"))

    expect(filters.map(node => node.textContent)).toEqual(["All (3)", "Herb Linter (3)"])
    expect(cards().every(card => card.getAttribute("data-herb-dev-tools-origin") === "Herb Linter")).toBe(true)
  })

  test("matches clear() against the origin as supplied", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Herb Engine Runtime", code: "one" }))
    panel.report(diagnostic({ origin: "Herb Linter", code: "two" }))

    panel.clear("Herb Engine Runtime ")

    expect(cards()).toHaveLength(1)
    expect(cards()[0].getAttribute("data-herb-dev-tools-origin")).toBe("Herb Linter")

    panel.clear("herb-linter")

    expect(cards()).toHaveLength(1)
  })

  test("finds a filter chip whose origin has spaces in it", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Herb Engine Runtime", code: "one" }))

    const chip = document.querySelector('[data-herb-dev-tools-origin="Herb Engine Runtime"]') as HTMLElement

    expect(chip).not.toBeNull()

    chip.click()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-filter-active")!.getAttribute("data-herb-dev-tools-origin"))
      .toBe("Herb Engine Runtime")
  })

  test("narrows the cards to one origin", () => {
    embed(PAYLOAD)
    createPanel()

    ;(document.querySelector('[data-herb-dev-tools-origin="Acme Scanner"]') as HTMLElement).click()

    expect(cards()).toHaveLength(1)
    expect(cards()[0].getAttribute("data-herb-dev-tools-origin")).toBe("Acme Scanner")
  })

  test("falls back to all origins when the filtered origin is cleared", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    ;(document.querySelector('[data-herb-dev-tools-origin="Acme Scanner"]') as HTMLElement).click()

    panel.clear("Acme Scanner")

    expect(document.querySelector(".herb-dev-tools-filter-active")!.getAttribute("data-herb-dev-tools-origin")).toBe("*")
    expect(cards().length).toBeGreaterThan(0)
  })
})

describe("report", () => {
  test("pushes a diagnostic into the panel", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "Acme Scanner", severity: "warning" }))

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-dot-warning")).not.toBeNull()
  })

  test("accepts a batch", () => {
    const panel = createPanel()

    panel.report([
      diagnostic({ message: "one", code: "a" }),
      diagnostic({ message: "two", code: "b" }),
    ])

    expect(cards()).toHaveLength(2)
  })

  test("renders an excerpt from a source the call carries", async () => {
    const panel = createPanel()

    panel.report(diagnostic({
      code: "html-no-nested-forms",
      location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      source: FIXABLE_SOURCE,
    }))

    const excerpt = await waitForExcerpt()

    expect(plain(excerpt)).toContain("<form")
  })

  test("diffs a fix against a source the call carries", async () => {
    const panel = createPanel()

    panel.report(diagnostic({
      code: "html-no-nested-forms",
      location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      source: FIXABLE_SOURCE,
      fix: { kind: "safe", source: FIXED_SOURCE },
    }))

    const fix = await waitForFix()

    expect(fix.querySelector(".herb-dev-tools-fix-diff")).not.toBeNull()
  })

  test("ignores an entry without a message", () => {
    const panel = createPanel()

    panel.report([{ template: "app/views/a.html.erb" } as RuntimeDiagnostic])

    expect(root()).toBeNull()
  })

  test("de-duplicates and shows a repeat count", () => {
    const panel = createPanel()
    const entry = diagnostic({ code: "html-no-nested-forms", location: { start: { line: 3, column: 1 } } })

    panel.report(entry)
    panel.report(entry)
    panel.report({ ...entry, location: { start: { line: 3, column: 40 } } })

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-repeat")!.textContent).toBe("×3")
  })

  test("returns a handle that removes what it added", () => {
    const panel = createPanel()

    panel.report(diagnostic({ code: "a" }))

    const handle = panel.report(diagnostic({ code: "b" }))

    expect(cards()).toHaveLength(2)

    handle.dismiss()

    expect(cards()).toHaveLength(1)
  })

  test("decrements a repeat instead of removing a shared card", () => {
    const panel = createPanel()
    const entry = diagnostic({ code: "a", location: { start: { line: 1, column: 1 } } })

    panel.report(entry)

    const handle = panel.report(entry)

    expect(document.querySelector(".herb-dev-tools-repeat")!.textContent).toBe("×2")

    handle.dismiss()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-repeat")).toBeNull()
  })

  test("drops the oldest entry past the queue cap", () => {
    const panel = createPanel()
    const batch: RuntimeDiagnostic[] = []

    for (let index = 0; index < MAX_RUNTIME_DIAGNOSTICS + 5; index++) {
      batch.push(diagnostic({ code: `rule-${index}`, location: { start: { line: index + 1, column: 1 } } }))
    }

    panel.report(batch)

    expect(cards()).toHaveLength(MAX_RUNTIME_DIAGNOSTICS)
    expect(document.body.innerHTML).not.toContain("rule-0<")
    expect(cards()[0].querySelector(".herb-dev-tools-code")!.textContent).toBe("rule-5")
  })

  test("keeps per-occurrence detail from a later duplicate", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    const base = {
      template: "app/views/posts/_post.html.erb",
      message: "Duplicate detail check",
      code: "demo-merge",
      severity: "warning" as const,
      origin: "demo-source",
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
    }

    panel.report(base)
    panel.report({ ...base, suggestion: "Arrived with the second copy", docsUrl: "https://herb-tools.dev/linter/rules/demo-merge" })

    const card = [...document.querySelectorAll(".herb-dev-tools-card")].find(element => element.textContent!.includes("Duplicate detail check"))!

    expect(card.textContent).toContain("Arrived with the second copy")
    expect(card.querySelector("a[href='https://herb-tools.dev/linter/rules/demo-merge']")).not.toBeNull()
    expect(card.textContent).toContain("2")
  })

  test("bounces the count only when a new diagnostic arrives", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    expect(document.querySelector(".herb-dev-tools-badge-count")!.classList.contains("herb-dev-tools-bump")).toBe(false)

    panel.report({ template: "app/views/posts/_post.html.erb", message: "New one", code: "demo-bounce", severity: "warning" })

    expect(document.querySelector(".herb-dev-tools-badge-count")!.classList.contains("herb-dev-tools-bump")).toBe(true)

    panel.open()

    expect(document.querySelector(".herb-dev-tools-badge-count")!.classList.contains("herb-dev-tools-bump")).toBe(false)
  })

  test("renders backtick fragments in messages as code", () => {
    embed({
      version: 1,
      diagnostics: [{
        template: "a.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        suggestion: "Use `link_to` instead.",
        code: "demo-code",
        severity: "error",
      }],
    })

    createPanel()

    const message = document.querySelector(".herb-dev-tools-message")!
    const suggestion = document.querySelector(".herb-dev-tools-suggestion")!

    expect(message.querySelector("code.herb-dev-tools-inline-code")!.textContent).toBe("<form>")
    expect(message.textContent).not.toContain("`")
    expect(suggestion.querySelector("code.herb-dev-tools-inline-code")!.textContent).toBe("link_to")
  })

  test("notifies the host when it opens so the menu can close", () => {
    embed(PAYLOAD)

    let opens = 0

    const panel = createPanel({ onOpen: () => { opens += 1 } })

    expect(opens).toBe(0)

    panel.open()

    expect(opens).toBe(1)

    panel.close()

    expect(opens).toBe(1)

    panel.show({ open: true })

    expect(opens).toBe(2)
  })

  test("renders paths as editor buttons when a handler is provided", () => {
    embed(PAYLOAD)

    const opened: Array<[string, number, number]> = []

    createPanel({ onOpenFile: (file, line, column) => opened.push([file, line, column]) })

    const frame = document.querySelector(".herb-dev-tools-frame-target") as HTMLElement

    expect(frame.tagName).toBe("BUTTON")

    frame.click()

    expect(opened).toHaveLength(1)
    expect(opened[0][0]).toBe("app/views/posts/_actions.html.erb")
  })

  test("renders paths as plain text without a handler", () => {
    embed(PAYLOAD)

    createPanel()

    expect((document.querySelector(".herb-dev-tools-frame-target") as HTMLElement).tagName).toBe("SPAN")
    expect(document.querySelector(".herb-dev-tools-path")).toBeNull()
  })
})

describe("clear", () => {
  test("removes only one origin", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.clear("Acme Scanner")

    const origins = cards().map(card => card.getAttribute("data-herb-dev-tools-origin"))

    expect(origins).toEqual(["Herb Linter", "Herb Engine Runtime"])
  })

  test("falls back to all origins when the selected filter no longer matches anything", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    ;(document.querySelector('[data-herb-dev-tools-origin="Herb Linter"]') as HTMLElement).click()

    expect(cards().length).toBeGreaterThan(0)

    panel.clear()
    panel.report({ template: "app/views/posts/_post.html.erb", message: "Fresh finding", code: "demo-fresh", severity: "warning", origin: "demo-source" })

    expect(cards()).toHaveLength(1)
  })

  test("removes everything without an argument", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.clear()

    expect(cards()).toHaveLength(0)
    expect(root()).toBeNull()
  })

  test("removes hook entries and payload entries alike", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.report(diagnostic({ origin: "Acme Scanner", code: "hook-rule" }))

    expect(cards()).toHaveLength(4)

    panel.clear("Acme Scanner")

    expect(cards()).toHaveLength(2)
  })
})

describe("destroy", () => {
  test("removes the chrome and stops reacting to a refresh", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.destroy()

    expect(root()).toBeNull()

    panel.refresh()

    expect(root()).toBeNull()
  })

  test("is safe to call more than once", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.destroy()

    expect(() => panel.destroy()).not.toThrow()
  })
})

describe("diagnostics that name an element", () => {
  test("render a locate control that scrolls to the element and flashes it", () => {
    const target = document.createElement("button")
    target.setAttribute("data-herb-toggle", "open")
    target.textContent = "Details"
    document.body.appendChild(target)

    const scrolled: unknown[] = []
    target.scrollIntoView = ((options: unknown) => { scrolled.push(options) }) as typeof target.scrollIntoView

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "nothing around this element declares the state `open`", code: "herb-unknown-state", element: target })

    const control = document.querySelector<HTMLElement>(".herb-dev-tools-element")!

    expect(control).not.toBeNull()
    expect(control.textContent).toContain('<button data-herb-toggle="open">')

    control.click()

    expect(scrolled).toHaveLength(1)
    expect(document.querySelector(".herb-element-flash")).not.toBeNull()
  })

  test("says the element has left the page instead of dropping the chip", () => {
    const target = document.createElement("span")

    target.id = "gone-away"
    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "gone", element: target })

    expect(document.querySelector('[data-herb-dev-tools-action="locate"]')).not.toBeNull()

    target.remove()
    panel.refresh()

    const chip = document.querySelector(".herb-dev-tools-element") as HTMLElement

    expect(chip).not.toBeNull()
    expect(chip.tagName).toBe("SPAN")
    expect(chip.classList.contains("herb-dev-tools-element-gone")).toBe(true)
    expect(chip.textContent).toContain("<span#gone-away>")
    expect(chip.textContent).toContain("no longer on the page")
    expect(chip.title).toBe("This element was on the page when it was reported and is not any more")
  })

  test("says an element is not visible when it is on the page with no box", () => {
    const target = document.createElement("span")

    target.id = "cover-three"
    target.style.display = "none"
    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "hidden", element: target })

    const chip = document.querySelector(".herb-dev-tools-element") as HTMLElement

    expect(chip.tagName).toBe("SPAN")
    expect(chip.classList.contains("herb-dev-tools-element-hidden")).toBe(true)
    expect(chip.textContent).toContain("<span#cover-three>")
    expect(chip.textContent).toContain("not visible (display: none)")
    expect(document.querySelector('[data-herb-dev-tools-action="locate"]')).toBeNull()
  })

  test("names the ancestor that hides an element the diagnostic named", () => {
    const parent = document.createElement("div")
    const target = document.createElement("span")

    parent.id = "modal"
    parent.style.display = "none"
    parent.appendChild(target)
    document.body.appendChild(parent)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "hidden", element: target })

    const chip = document.querySelector(".herb-dev-tools-element") as HTMLElement

    expect(chip.title).toBe("This element is on the page but nothing is rendered for it, because <div#modal> has display: none")
  })

  test("does not name an ancestor when the element hides itself", () => {
    const target = document.createElement("span")

    target.style.visibility = "hidden"
    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "hidden", element: target })

    const chip = document.querySelector(".herb-dev-tools-element") as HTMLElement

    expect(chip.textContent).toContain("not visible (visibility: hidden)")
    expect(chip.title).toBe("This element is on the page but nothing is rendered for it, so there is nothing to scroll to")
  })

  test("says an element that has no box of its own is not visible", () => {
    const target = document.createElement("div")

    target.style.display = "contents"
    target.textContent = "rendered by its children"
    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "contents", element: target })

    const chip = document.querySelector(".herb-dev-tools-element") as HTMLElement

    expect(chip.textContent).toContain("not visible (display: contents)")
  })

  test("keeps the locate control for an element that is merely scrolled out of view", () => {
    const target = document.createElement("div")

    target.textContent = "below the fold"
    target.style.marginTop = "300vh"
    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "offscreen", element: target })

    expect(document.querySelector('[data-herb-dev-tools-action="locate"]')).not.toBeNull()
  })

  test("offers no locate control for an element that has left the page", () => {
    const target = document.createElement("span")

    document.body.appendChild(target)

    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "gone", element: target })
    target.remove()
    panel.refresh()

    expect(document.querySelector('[data-herb-dev-tools-action="locate"]')).toBeNull()
    expect(getComputedStyle(document.querySelector(".herb-dev-tools-element")!).cursor).toBe("default")
  })

  test("says nothing at all when no element was named", () => {
    const panel = createPanel()

    panel.report({ template: "app/views/a.html.erb", message: "no element here" })

    expect(document.querySelector(".herb-dev-tools-element")).toBeNull()
  })
})

describe("diagnostics without a template", () => {
  test("are kept under a placeholder instead of being dropped", () => {
    const panel = createPanel()

    panel.report({ template: "", message: "nothing around this element declares the state `pending`", code: "herb-unknown-state", severity: "error" })

    expect(cards()).toHaveLength(1)
    expect(document.body.textContent).toContain("(unknown template)")
  })
})

describe("refresh", () => {
  test("replaces the payload's entries and keeps the reported ones", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.report(diagnostic({ origin: "Acme Scanner", code: "hook-rule", message: "reported at runtime" }))

    expect(cards()).toHaveLength(4)

    document.querySelector("script[data-herb-diagnostics]")!.remove()

    embed({ version: 1, diagnostics: [{ template: "app/views/new.html.erb", message: "fresh" }] })

    panel.refresh()

    expect(cards()).toHaveLength(2)

    const messages = [...document.querySelectorAll(".herb-dev-tools-message")].map(element => element.textContent)

    expect(messages).toContain("fresh")
    expect(messages).toContain("reported at runtime")
  })

  test("a navigation's refresh keeps what the client runtime reported before it", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.report(diagnostic({ code: "herb-state-type", message: "raised during the first scan" }))

    expect(cards()).toHaveLength(4)

    panel.refresh()

    expect(cards()).toHaveLength(4)
  })

  test("keeps the current entries when the page ships no payload", () => {
    const panel = createPanel()

    panel.report(diagnostic({ code: "hook-rule" }))
    panel.refresh()

    expect(cards()).toHaveLength(1)
  })
})

describe("highlighting cache", () => {
  test("rebuilds the renderers after a reset without warning", async () => {
    resetRuntimeHighlighting()

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    await waitForFix()

    expect(cards()).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("overlay", () => {
  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement | null
  }

  function backdrop() {
    return document.querySelector(".herb-dev-tools-backdrop") as HTMLElement | null
  }

  function escape() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
  }

  test("stays docked when nothing asks for an overlay", () => {
    const instance = createPanel()

    instance.report(diagnostic())

    expect(instance.overlay).toBeNull()
    expect(backdrop()).toBeNull()
    expect(badge()).not.toBeNull()
  })

  test("takes over the screen when a diagnostic asks to block", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))

    expect(instance.overlay).toBe("blocking")
    expect(panel()!.classList.contains("herb-dev-tools-overlay-blocking")).toBe(true)
    expect(panel()!.classList.contains("herb-dev-tools-overlay-focused")).toBe(true)
    expect(panel()!.getAttribute("aria-modal")).toBe("true")
    expect(backdrop()).toBeNull()
  })

  test("offers no way out of a blocking overlay", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))

    expect(badge()).toBeNull()
    expect(document.querySelector(".herb-dev-tools-close")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-hide")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-expand")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-clear")).toBeNull()

    escape()

    expect(instance.overlay).toBe("blocking")
    expect(panel()).not.toBeNull()
  })

  test("ignores dismissOverlay while blocking", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))
    instance.dismissOverlay()

    expect(instance.overlay).toBe("blocking")
  })

  test("shows a blocking overlay over a panel hidden for the session", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "one" }))
    instance.dismiss()

    expect(panel()).toBeNull()

    instance.report(diagnostic({ code: "two", overlay: "blocking" }))

    expect(instance.dismissed).toBe(true)
    expect(panel()).not.toBeNull()
    expect(instance.overlay).toBe("blocking")
  })

  test("locks page scroll while blocking and gives it back afterwards", () => {
    const instance = createPanel()
    const before = document.documentElement.style.overflow

    const handle = instance.report(diagnostic({ overlay: "blocking" }))

    expect(document.documentElement.style.overflow).toBe("hidden")

    handle.dismiss()

    expect(instance.overlay).toBeNull()
    expect(document.documentElement.style.overflow).toBe(before)
  })

  test("gives page scroll back on destroy", () => {
    const instance = createPanel()
    const before = document.documentElement.style.overflow

    instance.report(diagnostic({ overlay: "blocking" }))
    instance.destroy()

    expect(document.documentElement.style.overflow).toBe(before)
  })

  test("lets the reporter take a blocking overlay down through its handle", () => {
    const instance = createPanel()

    const handle = instance.report(diagnostic({ overlay: "blocking" }))

    handle.dismiss()

    expect(instance.overlay).toBeNull()
    expect(panel()).toBeNull()
  })

  test("leaves only the full-screen mode behind, keeping the panel open", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
    ])

    const close = document.querySelector('[data-herb-dev-tools-action="dismiss-overlay"]') as HTMLButtonElement

    expect(close).not.toBeNull()

    close.click()

    expect(instance.overlay).toBeNull()
    expect(backdrop()).toBeNull()
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
    expect(panel()!.classList.contains("herb-dev-tools-overlay-focused")).toBe(false)
    expect(cards()).toHaveLength(2)
  })

  test("keeps the error it just featured visible in the panel", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "unhydrated", origin: "Herb Client Runtime", overlay: "dismissible" }),
    ])

    instance.dismissOverlay()

    const featured = Array.from(document.querySelectorAll(".herb-dev-tools-card"))
      .find(card => card.querySelector(".herb-dev-tools-code")?.textContent === "unhydrated") as HTMLElement

    expect(featured).toBeDefined()
    expect(featured.offsetParent).not.toBeNull()
    expect(featured.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  test("selects the featured error's own filter chip on the way out", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "unhydrated", origin: "Herb Client Runtime", overlay: "dismissible" }),
    ])

    instance.dismissOverlay()

    const active = document.querySelector(".herb-dev-tools-filter-active") as HTMLButtonElement

    expect(active.getAttribute("data-herb-dev-tools-origin")).toBe("Herb Client Runtime")
    expect(Array.from(document.querySelectorAll(".herb-dev-tools-code")).map(node => node.textContent))
      .toEqual(["unhydrated"])
  })

  test("overrides a filter that would have hidden the featured error", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }))

    ;(document.querySelector('[data-herb-dev-tools-origin="Herb Linter"]') as HTMLButtonElement).click()

    instance.report(diagnostic({ code: "unhydrated", origin: "Herb Client Runtime", overlay: "dismissible" }))
    instance.dismissOverlay()

    expect(Array.from(document.querySelectorAll(".herb-dev-tools-code")).map(node => node.textContent))
      .toContain("unhydrated")
  })

  test("falls back to All when the featured errors span origins", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", origin: "Herb Client Runtime", overlay: "dismissible" }),
      diagnostic({ code: "two", origin: "Herb Parser", overlay: "dismissible" }),
    ])

    instance.dismissOverlay()

    const active = document.querySelector(".herb-dev-tools-filter-active") as HTMLButtonElement

    expect(active.getAttribute("data-herb-dev-tools-origin")).toBe("*")
    expect(cards()).toHaveLength(2)
  })

  test("drops to the open panel when the overlay is escaped away", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "dismissible" }))

    escape()

    expect(instance.overlay).toBeNull()
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
    expect(instance.count).toBe(1)
  })

  test("closes a widened dismissible overlay by its backdrop", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
    ])

    expect(backdrop()!.getAttribute("data-herb-dev-tools-action")).toBe("dismiss-overlay")

    instance.toggleOverlayScope()

    expect(backdrop()!.getAttribute("data-herb-dev-tools-action")).toBe("dismiss-overlay")

    backdrop()!.click()

    expect(instance.overlay).toBeNull()
  })

  test("gives a dismissible overlay the same chrome inside a box, plus a way out", () => {
    const instance = createPanel()

    instance.report(diagnostic({ origin: "Herb Client Runtime", overlay: "dismissible" }))

    const element = panel()!
    const box = element.getBoundingClientRect()

    expect(element.classList.contains("herb-dev-tools-overlay-focused")).toBe(true)
    expect(element.classList.contains("herb-dev-tools-overlay-fullscreen")).toBe(false)
    expect(parseFloat(getComputedStyle(element).borderRadius)).toBeGreaterThan(0)
    expect(box.width).toBeLessThan(window.innerWidth)
    expect(box.height).toBeLessThan(window.innerHeight)
    expect(backdrop()).not.toBeNull()

    expect(document.querySelector(".herb-dev-tools-title")!.textContent).toBe("Herb Client Runtime")

    const close = document.querySelector('[data-herb-dev-tools-action="dismiss-overlay"]') as HTMLButtonElement

    close.click()

    expect(instance.overlay).toBeNull()
    expect(panel()!.classList.contains("herb-dev-tools-overlay-focused")).toBe(false)
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
  })

  test("keeps the blocking screen edge to edge and the dismissible one inside a box", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))

    const boxed = panel()!.getBoundingClientRect()

    instance.report(diagnostic({ code: "broke", overlay: "blocking" }))

    const full = panel()!.getBoundingClientRect()

    expect(boxed.width).toBeLessThan(full.width)
    expect(full.width).toBe(window.innerWidth)
    expect(backdrop()).toBeNull()
  })

  test("sizes the header path to its content and keeps the controls flush right", () => {
    const instance = createPanel()

    instance.report(diagnostic({
      template: "app/components/post_actions_component.html.erb",
      origin: "Herb Client Runtime",
      location: { start: { line: 2, column: 3 } },
      overlay: "dismissible",
    }))

    const header = document.querySelector(".herb-dev-tools-header") as HTMLElement
    const path = header.querySelector(".herb-dev-tools-summary") as HTMLElement
    const close = header.querySelector(".herb-dev-tools-close") as HTMLElement

    expect(getComputedStyle(path).flexGrow).toBe("0")

    const padding = parseFloat(getComputedStyle(header).paddingRight)

    expect(close.getBoundingClientRect().right).toBeCloseTo(header.getBoundingClientRect().right - padding, 0)
  })

  test("accents the screen with the severity it is showing", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "one", severity: "warning", overlay: "dismissible" }))

    const header = () => getComputedStyle(document.querySelector(".herb-dev-tools-header") as HTMLElement).backgroundColor
    const warning = header()

    instance.report(diagnostic({ code: "two", severity: "error", overlay: "dismissible" }))

    expect(header()).not.toBe(warning)
  })

  test("takes down every overlay it was showing, and no future one", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", overlay: "dismissible" }),
      diagnostic({ code: "two", overlay: "dismissible" }),
    ])

    instance.dismissOverlay()

    expect(instance.overlay).toBeNull()

    instance.report(diagnostic({ code: "three", overlay: "dismissible" }))

    expect(instance.overlay).toBe("dismissible")
    expect(cards()).toHaveLength(1)
  })

  test("lets a blocking diagnostic override a dismissed overlay", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "one", overlay: "dismissible" }))
    instance.dismissOverlay()
    instance.report(diagnostic({ code: "two", overlay: "blocking" }))

    expect(instance.overlay).toBe("blocking")
  })

  test("escalates to blocking when a repeat of the same diagnostic blocks", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "one", overlay: "dismissible" }))
    instance.report(diagnostic({ code: "one", overlay: "blocking" }))

    expect(instance.overlay).toBe("blocking")
  })

  test("reads an overlay out of the embedded report payload", () => {
    embed({
      version: 1,
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        overlay: "blocking",
      }],
    })

    const instance = createPanel()

    expect(instance.overlay).toBe("blocking")
    expect(panel()!.classList.contains("herb-dev-tools-overlay-blocking")).toBe(true)
  })

  test("shows only the blocking entry, not the rest of the panel", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries", origin: "Herb Engine Runtime" }),
    ])

    expect(cards()).toHaveLength(2)

    instance.report(diagnostic({ code: "broke", origin: "Herb Parser", overlay: "blocking" }))

    expect(cards()).toHaveLength(1)
    expect(cards()[0].querySelector(".herb-dev-tools-code")!.textContent).toBe("broke")
    expect(instance.count).toBe(3)
  })

  test("shows only the dismissible entry while its overlay is up", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
    ])

    expect(cards()).toHaveLength(1)
    expect(cards()[0].querySelector(".herb-dev-tools-code")!.textContent).toBe("unhydrated")

    instance.dismissOverlay()

    expect(cards()).toHaveLength(2)
  })

  test("leaves the dismissible entries out of a blocking overlay", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    expect(instance.overlay).toBe("blocking")
    expect(cards()).toHaveLength(1)
    expect(cards()[0].querySelector(".herb-dev-tools-code")!.textContent).toBe("broke")
  })

  test("hides the origin filters while an overlay is up", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", origin: "Herb Linter" }),
      diagnostic({ code: "broke", origin: "Herb Parser", overlay: "blocking" }),
    ])

    expect(document.querySelector(".herb-dev-tools-filters")).toBeNull()

    instance.clear("Herb Parser")

    expect(document.querySelector(".herb-dev-tools-filters")).not.toBeNull()
  })

  test("heads a single blocking error with its origin and location", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", severity: "warning" }),
      diagnostic({ code: "two", severity: "warning" }),
    ])

    instance.report(diagnostic({
      code: "broke",
      severity: "error",
      origin: "Herb Parser",
      location: { start: { line: 11, column: 3 } },
      overlay: "blocking",
    }))

    expect(document.querySelector(".herb-dev-tools-title")!.textContent).toBe("Herb Parser")
    expect(document.querySelector(".herb-dev-tools-summary")!.textContent)
      .toBe("app/views/posts/_actions.html.erb:11:3")
  })

  test("carries no glyph in the blocking header", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))

    const header = document.querySelector(".herb-dev-tools-header")!

    expect(header.querySelector(".herb-dev-tools-blocking-glyph")).toBeNull()
    expect(header.querySelector(".herb-dev-tools-badge-glyph")).toBeNull()
    expect(header.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  test("opens the file from the blocking header path", () => {
    const opened: unknown[] = []
    const instance = createPanel({ onOpenFile: (file, line, column) => opened.push([file, line, column]) })

    instance.report(diagnostic({
      origin: "Herb Parser",
      location: { start: { line: 11, column: 3 } },
      overlay: "blocking",
    }))

    const path = document.querySelector(".herb-dev-tools-summary") as HTMLButtonElement

    expect(path.tagName).toBe("BUTTON")

    path.click()

    expect(opened).toEqual([["app/views/posts/_actions.html.erb", 11, 3]])
  })

  test("leaves the header path as text with no editor handler", () => {
    const instance = createPanel()

    instance.report(diagnostic({ location: { start: { line: 11, column: 3 } }, overlay: "blocking" }))

    expect((document.querySelector(".herb-dev-tools-summary") as HTMLElement).tagName).toBe("SPAN")
  })

  test("widens the excerpt and enlarges the code in a focused overlay", async () => {
    const longSource = Array.from({ length: 40 }, (_, index) => `  <p>line ${index + 1}</p>`).join("\n")

    embed({
      version: 1,
      sources: { "app/views/posts/_actions.html.erb": longSource },
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        code: "html-no-nested-forms",
        severity: "error",
        origin: "Herb Parser",
        location: { start: { line: 20, column: 3 }, end: { line: 20, column: 10 } },
        overlay: "blocking",
      }],
    })

    const instance = createPanel()

    const element = await waitForExcerpt()

    expect(parseFloat(getComputedStyle(element).fontSize)).toBeGreaterThan(12)

    const focused = element.textContent!.split("\n").length

    instance.toggleOverlayScope()

    const widened = await waitFor(
      () => document.querySelector(".herb-dev-tools-ansi") as HTMLElement | null,
      "the excerpt to re-render",
    )

    expect(focused).toBeGreaterThan(widened.textContent!.split("\n").length)
    expect(parseFloat(getComputedStyle(widened).fontSize)).toBeLessThan(12)
  })

  test("falls back to a count when blocking entries disagree on origin", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", origin: "Herb Parser", overlay: "blocking" }),
      diagnostic({ code: "two", origin: "Herb Validator", overlay: "blocking" }),
    ])

    expect(document.querySelector(".herb-dev-tools-title")!.textContent).toBe("Herb Runtime Diagnostics")
    expect(document.querySelector(".herb-dev-tools-summary")!.textContent).toBe("2 errors")
  })

  test("gives a blocking screen its own full-screen chrome", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))

    const element = document.querySelector(".herb-dev-tools-panel") as HTMLElement
    const styles = getComputedStyle(element)
    const box = element.getBoundingClientRect()

    expect(element.classList.contains("herb-dev-tools-overlay-focused")).toBe(true)
    expect(styles.borderRadius).toBe("0px")
    expect(box.width).toBe(window.innerWidth)
    expect(box.height).toBe(window.innerHeight)
  })

  test("keeps the blocking screen from scrolling sideways", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "blocking" }))

    const body = document.querySelector(".herb-dev-tools-body") as HTMLElement
    const card = document.querySelector(".herb-dev-tools-card") as HTMLElement

    expect(body.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth)
    expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  })

  test("relaxes the chrome but stays edge to edge when a blocking overlay widens", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    instance.toggleOverlayScope()

    const element = document.querySelector(".herb-dev-tools-panel") as HTMLElement
    const box = element.getBoundingClientRect()

    expect(element.classList.contains("herb-dev-tools-overlay-focused")).toBe(false)
    expect(element.classList.contains("herb-dev-tools-overlay-fullscreen")).toBe(true)
    expect(box.width).toBe(window.innerWidth)
    expect(box.height).toBe(window.innerHeight)
    expect(backdrop()).toBeNull()
  })

  test("puts a widened dismissible overlay back in its box", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
    ])

    instance.toggleOverlayScope()

    const element = document.querySelector(".herb-dev-tools-panel") as HTMLElement

    expect(element.classList.contains("herb-dev-tools-overlay-fullscreen")).toBe(false)
    expect(element.getBoundingClientRect().width).toBeLessThan(window.innerWidth)
  })

  test("offers no Clear control inside a dismissible overlay", () => {
    const instance = createPanel()

    instance.report(diagnostic({ overlay: "dismissible" }))

    expect(document.querySelector(".herb-dev-tools-clear")).toBeNull()

    instance.dismissOverlay()

    expect(document.querySelector(".herb-dev-tools-clear")).not.toBeNull()
  })

  test("offers the widen control only when the overlay is hiding something", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "broke", overlay: "blocking" }))

    expect(document.querySelector('[data-herb-dev-tools-action="overlay-scope"]')).toBeNull()

    instance.report(diagnostic({ code: "linted", severity: "warning" }))

    const scope = document.querySelector('[data-herb-dev-tools-action="overlay-scope"]') as HTMLButtonElement

    expect(scope).not.toBeNull()
    expect(scope.textContent).toBe("Show other diagnostics")
  })

  test("shows everything behind a blocking overlay and comes back", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "broke", origin: "Herb Parser", overlay: "blocking" }),
    ])

    expect(cards()).toHaveLength(1)

    const scope = () => document.querySelector('[data-herb-dev-tools-action="overlay-scope"]') as HTMLButtonElement

    scope().click()

    expect(instance.overlayShowingAll).toBe(true)
    expect(cards()).toHaveLength(2)
    expect(document.querySelector(".herb-dev-tools-filters")).not.toBeNull()
    expect(scope().textContent).toBe("Back to the error")

    scope().click()

    expect(instance.overlayShowingAll).toBe(false)
    expect(cards()).toHaveLength(1)
  })

  test("keeps a blocking overlay blocking while it shows everything", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    instance.toggleOverlayScope()

    expect(document.querySelector(".herb-dev-tools-close")).toBeNull()
    expect(document.querySelector(".herb-dev-tools-hide")).toBeNull()
    expect(document.documentElement.style.overflow).toBe("hidden")

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(instance.overlay).toBe("blocking")
  })

  test("forgets the widened scope once the overlay goes", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", origin: "Herb Parser", overlay: "blocking" }),
    ])

    instance.toggleOverlayScope()
    instance.clear("Herb Parser")

    expect(instance.overlayShowingAll).toBe(false)
  })

  test("forgets a dismissal once the diagnostic is cleared", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "one", overlay: "dismissible" }))
    instance.dismissOverlay()
    instance.clear()
    instance.report(diagnostic({ code: "one", overlay: "dismissible" }))

    expect(instance.overlay).toBe("dismissible")
  })
})

describe("re-raising a dismissed overlay", () => {
  test("raises again when the same diagnostic is reported again", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))
    instance.dismissOverlay()

    expect(instance.overlay).toBeNull()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))

    expect(instance.overlay).toBe("dismissible")
    expect(instance.count).toBe(2)
  })

  test("stays down across renders that report nothing", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))
    instance.dismissOverlay()

    instance.report(diagnostic({ code: "linted", severity: "warning" }))
    instance.open()
    instance.expand()
    instance.collapse()

    expect(instance.overlay).toBeNull()
  })

  test("raises again when a fresh payload carries the overlay", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))
    instance.dismissOverlay()

    embed({
      version: 1,
      diagnostics: [{
        template: "app/views/posts/_actions.html.erb",
        message: "Nested `<form>` elements are not allowed.",
        code: "unhydrated",
        overlay: "dismissible",
      }],
    })

    instance.refresh()

    expect(instance.overlay).toBe("dismissible")
  })
})

describe("featuring an entry from the panel", () => {
  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement | null
  }

  function featureButtons() {
    return Array.from(document.querySelectorAll('[data-herb-dev-tools-action="feature"]')) as HTMLButtonElement[]
  }

  function seed(instance: RuntimePanel) {
    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries", origin: "Herb Engine Runtime" }),
    ])
  }

  test("offers a control on every card in the docked panel", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()

    expect(featureButtons()).toHaveLength(2)
  })

  test("puts a plain entry on its own dismissible screen", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()

    featureButtons()[0].click()

    expect(instance.overlay).toBe("dismissible")
    expect(instance.featured).not.toBeNull()
    expect(panel()!.classList.contains("herb-dev-tools-overlay-focused")).toBe(true)
    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-code")!.textContent).toBe("linted")
    expect(document.querySelector(".herb-dev-tools-title")!.textContent).toBe("Herb Linter")
  })

  test("leaves the diagnostic itself untouched", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    featureButtons()[0].click()
    instance.dismissOverlay()

    expect(instance.overlay).toBeNull()
    expect(instance.featured).toBeNull()

    instance.open()
    featureButtons()[0].click()

    expect(instance.overlay).toBe("dismissible")
  })

  test("hides its own control while a screen is featured", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    featureButtons()[0].click()

    expect(featureButtons()).toHaveLength(0)
  })

  test("offers no control while a blocking overlay outranks it", () => {
    const instance = createPanel()

    seed(instance)
    instance.report(diagnostic({ code: "broke", overlay: "blocking" }))
    instance.toggleOverlayScope()

    expect(featureButtons()).toHaveLength(0)
  })

  test("gives way to a declared overlay", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    featureButtons()[0].click()

    instance.report(diagnostic({ code: "unhydrated", origin: "Herb Client Runtime", overlay: "dismissible" }))

    expect(document.querySelector(".herb-dev-tools-code")!.textContent).toBe("unhydrated")
  })

  test("forgets a featured entry once it is cleared", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    featureButtons()[0].click()

    instance.clear("Herb Linter")

    expect(instance.featured).toBeNull()
    expect(instance.overlay).toBeNull()
  })

  test("ignores a key that names nothing", () => {
    const instance = createPanel()

    seed(instance)
    instance.feature("not a key")

    expect(instance.overlay).toBeNull()
  })
})

describe("overlay heading bar", () => {
  function header() {
    return document.querySelector(".herb-dev-tools-header") as HTMLElement
  }

  function metrics(element: HTMLElement) {
    const styles = getComputedStyle(element)

    return { padding: styles.padding, gap: styles.gap }
  }

  test("puts no count on the widen control, since none of them is the right one", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    const scope = document.querySelector('[data-herb-dev-tools-action="overlay-scope"]') as HTMLButtonElement

    expect(scope.textContent).toBe("Show other diagnostics")
    expect(scope.textContent).not.toMatch(/\d/)
  })

  test("names the hidden count where there is room to be exact", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    const scope = () => document.querySelector('[data-herb-dev-tools-action="overlay-scope"]') as HTMLButtonElement

    expect(scope().title).toBe("Show the other 2 diagnostics this page reported")

    instance.clear("unknown")
    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    expect(scope().title).toBe("Show the one other diagnostic this page reported")
  })

  test("keeps one bar layout across the focused and widened views", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    const focused = metrics(header())
    const focusedTitle = getComputedStyle(document.querySelector(".herb-dev-tools-title") as HTMLElement).fontSize

    instance.toggleOverlayScope()

    const widened = metrics(header())
    const widenedTitle = getComputedStyle(document.querySelector(".herb-dev-tools-title") as HTMLElement).fontSize

    expect(widened).toEqual(focused)
    expect(widenedTitle).toBe(focusedTitle)
  })

  test("groups the controls to the right in both views", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "unhydrated", overlay: "dismissible" }),
    ])

    const controls = () => header().querySelector(".herb-dev-tools-window-controls") as HTMLElement

    expect(controls()).toBe(header().lastElementChild)
    expect(Array.from(controls().children).map(node => node.getAttribute("data-herb-dev-tools-action")))
      .toEqual(["overlay-scope", "dismiss-overlay"])

    instance.toggleOverlayScope()

    expect(controls()).toBe(header().lastElementChild)
    expect(Array.from(controls().children).map(node => node.getAttribute("data-herb-dev-tools-action")))
      .toEqual(["overlay-scope", "dismiss-overlay"])
  })

  test("lines the filter chips up with the heading bar", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning" }),
      diagnostic({ code: "broke", overlay: "blocking" }),
    ])

    instance.toggleOverlayScope()

    const filters = document.querySelector(".herb-dev-tools-filters") as HTMLElement

    expect(getComputedStyle(filters).paddingLeft).toBe(getComputedStyle(header()).paddingLeft)
  })
})

describe("overlay severity accent", () => {
  function band() {
    const header = document.querySelector(".herb-dev-tools-header") as HTMLElement

    return getComputedStyle(header)
  }

  test("tints instead of filling, keeping the text dark", () => {
    const instance = createPanel()

    instance.report(diagnostic({ severity: "error", overlay: "dismissible" }))

    const styles = band()

    expect(styles.backgroundColor).not.toBe("rgb(220, 38, 38)")
    expect(styles.color).not.toBe("rgb(255, 255, 255)")
    expect(styles.backgroundColor).not.toBe("rgb(249, 250, 251)")
    expect(styles.borderBottomColor).not.toBe("rgb(229, 231, 235)")
    expect(styles.boxShadow).toBe("none")
  })

  test("takes the accent from the severity it is showing", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "warned", severity: "warning", overlay: "dismissible" }))

    const warning = band().backgroundColor

    instance.dismissOverlay()
    instance.report(diagnostic({ code: "errored", severity: "error", overlay: "dismissible" }))

    expect(band().backgroundColor).not.toBe(warning)
  })

  test("follows the featured entry, not the loudest entry in the panel", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "errored", severity: "error" }))
    instance.report(diagnostic({ code: "warned", severity: "warning", overlay: "dismissible" }))

    const featured = band().backgroundColor

    instance.dismissOverlay()
    instance.clear()
    instance.report(diagnostic({ code: "warned", severity: "warning", overlay: "dismissible" }))

    expect(band().backgroundColor).toBe(featured)
  })

  test("carries a severity dot, not an emoji", () => {
    const instance = createPanel()

    instance.report(diagnostic({ severity: "warning", overlay: "dismissible" }))

    const header = document.querySelector(".herb-dev-tools-header")!

    expect(header.querySelector(".herb-dev-tools-dot-warning")).not.toBeNull()
    expect(header.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe("heading bar across the overlay toggle", () => {
  function header() {
    return document.querySelector(".herb-dev-tools-header") as HTMLElement
  }

  function chrome() {
    const styles = getComputedStyle(header())

    return {
      background: styles.backgroundColor,
      border: styles.borderBottomColor,
      shadow: styles.boxShadow,
      color: styles.color,
      padding: styles.padding,
    }
  }

  test("keeps the bar's size but drops the colour when the view widens", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "error", origin: "Herb Linter" }),
      diagnostic({ code: "broke", severity: "error", origin: "Herb Parser", overlay: "blocking" }),
    ])

    const featured = chrome()

    expect(header().querySelector(".herb-dev-tools-dot-error")).not.toBeNull()

    instance.toggleOverlayScope()

    const widened = chrome()

    expect(widened.padding).toBe(featured.padding)
    expect(widened.background).not.toBe(featured.background)
    expect(widened.background).toBe("rgb(249, 250, 251)")
    expect(header().querySelector(".herb-dev-tools-dot")).toBeNull()
  })

  test("does the same for a dismissible overlay", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "unhydrated", severity: "warning", origin: "Herb Client Runtime", overlay: "dismissible" }),
    ])

    const featured = chrome()

    instance.toggleOverlayScope()

    expect(chrome().padding).toBe(featured.padding)
    expect(chrome().background).toBe("rgb(249, 250, 251)")
  })

  test("leaves the docked panel header untinted", () => {
    const instance = createPanel()

    instance.report(diagnostic({ severity: "error" }))
    instance.open()

    const docked = chrome()

    expect(docked.background).toBe("rgb(249, 250, 251)")
    expect(docked.shadow).toBe("none")
    expect(header().querySelector(".herb-dev-tools-dot")).toBeNull()
  })
})

describe("expanding the docked panel", () => {
  function header() {
    return document.querySelector(".herb-dev-tools-header") as HTMLElement
  }

  function chrome() {
    const styles = getComputedStyle(header())

    return {
      background: styles.backgroundColor,
      border: styles.borderBottomColor,
      color: styles.color,
      padding: styles.padding,
      title: getComputedStyle(document.querySelector(".herb-dev-tools-title") as HTMLElement).fontSize,
    }
  }

  test("uses the widened overlay's heading bar, not the docked one", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "linted", severity: "error", origin: "Herb Linter" }),
      diagnostic({ code: "broke", severity: "error", origin: "Herb Parser", overlay: "blocking" }),
    ])

    instance.toggleOverlayScope()

    const widened = chrome()

    instance.clear("Herb Parser")
    instance.open()

    const docked = chrome()

    instance.expand()

    expect(chrome()).toEqual(widened)
    expect(docked).not.toEqual(widened)
  })

  test("stays neutral, since nothing is featured", () => {
    const instance = createPanel()

    instance.report(diagnostic({ code: "warned", severity: "warning" }))
    instance.open()
    instance.expand()

    const warning = chrome().background

    instance.report(diagnostic({ code: "errored", severity: "error" }))

    expect(chrome().background).toBe(warning)
    expect(chrome().background).toBe("rgb(249, 250, 251)")
    expect(header().querySelector(".herb-dev-tools-dot")).toBeNull()
  })

  test("goes back to the compact bar when collapsed", () => {
    const instance = createPanel()

    instance.report(diagnostic({ severity: "error" }))
    instance.open()

    const docked = chrome()

    instance.expand()
    instance.collapse()

    expect(chrome()).toEqual(docked)
    expect(header().querySelector(".herb-dev-tools-dot")).toBeNull()
  })
})

describe("severity filter", () => {
  function severityChips() {
    return Array.from(document.querySelectorAll("[data-herb-dev-tools-severity]")) as HTMLButtonElement[]
  }

  function chip(value: string) {
    return document.querySelector(`[data-herb-dev-tools-severity="${value}"]`) as HTMLButtonElement
  }

  function originChip(value: string) {
    return document.querySelector(`[data-herb-dev-tools-origin="${value}"]`) as HTMLButtonElement
  }

  function codes() {
    return Array.from(document.querySelectorAll(".herb-dev-tools-code")).map(node => node.textContent)
  }

  function seed(instance: RuntimePanel) {
    instance.report([
      diagnostic({ code: "broke", severity: "error", origin: "Herb Parser" }),
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "styled", severity: "warning", origin: "Acme Scanner" }),
      diagnostic({ code: "noted", severity: "info", origin: "Herb Linter" }),
      diagnostic({ code: "hinted", severity: "hint", origin: "Herb Linter" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries", origin: "Herb Engine Runtime" }),
    ])

    instance.open()
  }

  test("offers a chip per severity present, counting each", () => {
    const instance = createPanel()

    seed(instance)

    expect(severityChips().map(node => node.textContent))
      .toEqual(["Any severity (6)", "Errors (1)", "Warnings (2)", "Notices (2)", "Metrics (1)"])
  })

  test("folds info and hint together the way the summary does", () => {
    const instance = createPanel()

    seed(instance)
    chip("notice").click()

    expect(codes()).toEqual(["noted", "hinted"])
  })

  test("narrows the list and marks the chip active", () => {
    const instance = createPanel()

    seed(instance)

    expect(cards()).toHaveLength(6)

    chip("warning").click()

    expect(codes()).toEqual(["linted", "styled"])
    expect(chip("warning").getAttribute("aria-pressed")).toBe("true")
    expect(chip("*").getAttribute("aria-pressed")).toBe("false")

    chip("*").click()

    expect(cards()).toHaveLength(6)
  })

  test("separates metrics from diagnostics", () => {
    const instance = createPanel()

    seed(instance)
    chip("metric").click()

    expect(codes()).toEqual(["measured"])

    chip("error").click()

    expect(codes()).toEqual(["broke"])
  })

  test("combines with the origin filter", () => {
    const instance = createPanel()

    seed(instance)

    originChip("Herb Linter").click()
    chip("warning").click()

    expect(codes()).toEqual(["linted"])
  })

  test("recounts each group against the other filter", () => {
    const instance = createPanel()

    seed(instance)
    originChip("Herb Linter").click()

    expect(severityChips().map(node => node.textContent))
      .toEqual(["Any severity (3)", "Warnings (1)", "Notices (2)"])

    chip("notice").click()

    expect(Array.from(document.querySelectorAll(".herb-dev-tools-filter[data-herb-dev-tools-origin]"))
      .map(node => node.textContent)).toEqual(["All (2)", "Herb Linter (2)"])
  })

  test("stays out of the way when everything shares one severity", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", severity: "error" }),
      diagnostic({ code: "two", severity: "error" }),
    ])

    instance.open()

    expect(severityChips()).toHaveLength(0)
  })

  test("releases a filter whose entries are all gone", () => {
    const instance = createPanel()

    seed(instance)
    chip("metric").click()

    expect(cards()).toHaveLength(1)

    instance.clear("Herb Engine Runtime")

    expect(chip("metric")).toBeNull()
    expect(chip("*").getAttribute("aria-pressed")).toBe("true")
    expect(cards()).toHaveLength(5)
  })

  test("drops the whole row when one severity is left", () => {
    const instance = createPanel()

    seed(instance)

    instance.clear("Herb Engine Runtime")
    instance.clear("Herb Linter")
    instance.clear("Acme Scanner")

    expect(severityChips()).toHaveLength(0)
    expect(cards()).toHaveLength(1)
  })

  test("is cleared when an overlay hands back to the panel", () => {
    const instance = createPanel()

    seed(instance)
    chip("metric").click()

    instance.report(diagnostic({ code: "unhydrated", severity: "error", origin: "Herb Client Runtime", overlay: "dismissible" }))
    instance.dismissOverlay()

    expect(codes()).toEqual(["unhydrated"])
  })

  test("survives a reload the way the origin filter does", () => {
    embed(PAYLOAD)

    const first = createPanel()

    first.open()
    chip("warning").click()

    const before = Array.from(document.querySelectorAll(".herb-dev-tools-code")).map(node => node.textContent)

    first.destroy()
    document.body.innerHTML = ""
    embed(PAYLOAD)

    const second = createPanel()

    second.open()

    expect(chip("warning").getAttribute("aria-pressed")).toBe("true")
    expect(Array.from(document.querySelectorAll(".herb-dev-tools-code")).map(node => node.textContent)).toEqual(before)
  })
})

describe("leaving a featured overlay", () => {
  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement | null
  }

  function state(instance: RuntimePanel) {
    return {
      overlay: instance.overlay,
      featured: instance.featured,
      expanded: instance.expanded,
      open: panel()!.classList.contains("herb-dev-tools-open"),
      focused: panel()!.classList.contains("herb-dev-tools-overlay-focused"),
      backdrop: document.querySelector(".herb-dev-tools-backdrop") !== null,
    }
  }

  function seed(instance: RuntimePanel) {
    instance.report([
      diagnostic({ code: "linted", severity: "warning", origin: "Herb Linter" }),
      diagnostic({ code: "measured", kind: "metric", value: "3 SQL queries", origin: "Herb Engine Runtime" }),
    ])
  }

  function click(action: string) {
    ;(document.querySelector(`[data-herb-dev-tools-action="${action}"]`) as HTMLButtonElement).click()
  }

  test("lands in the docked panel, whatever it was expanded to before", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    instance.expand()

    expect(instance.expanded).toBe(true)

    click("feature")

    expect(state(instance)).toMatchObject({ overlay: "dismissible", focused: true, expanded: true })

    click("dismiss-overlay")

    expect(state(instance)).toEqual({
      overlay: null,
      featured: null,
      expanded: false,
      open: true,
      focused: false,
      backdrop: false,
    })
  })

  test("lands in the same place whether or not it was expanded first", () => {
    const collapsed = createPanel()

    seed(collapsed)
    collapsed.open()
    click("feature")
    click("dismiss-overlay")

    const withoutExpanding = state(collapsed)

    collapsed.destroy()
    document.body.innerHTML = ""
    sessionStorage.clear()

    const expanded = createPanel()

    seed(expanded)
    expanded.open()
    expanded.expand()
    click("feature")
    click("dismiss-overlay")

    expect(state(expanded)).toEqual(withoutExpanding)
  })

  test("collapses a reported dismissible overlay out of full screen too", () => {
    const instance = createPanel()

    seed(instance)
    instance.open()
    instance.expand()

    instance.report(diagnostic({ code: "unhydrated", origin: "Herb Client Runtime", overlay: "dismissible" }))
    instance.dismissOverlay()

    expect(instance.expanded).toBe(false)
    expect(document.querySelector(".herb-dev-tools-backdrop")).toBeNull()
  })
})

describe("header control alignment", () => {
  function header() {
    return document.querySelector(".herb-dev-tools-header") as HTMLElement
  }

  function measure() {
    const element = header()
    const box = element.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(element).gap)
    const padding = parseFloat(getComputedStyle(element).paddingRight)

    return {
      element,
      box,
      gap,
      padding,
      title: element.querySelector(".herb-dev-tools-title")!.getBoundingClientRect(),
      clear: element.querySelector(".herb-dev-tools-clear")!.getBoundingClientRect(),
      hide: element.querySelector(".herb-dev-tools-hide")!.getBoundingClientRect(),
      controls: element.querySelector(".herb-dev-tools-window-controls")!.getBoundingClientRect(),
    }
  }

  test("groups every action on the right, with the title alone on the left", () => {
    embed(PAYLOAD)

    createPanel().open()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "640px"

    const { box, gap, padding, title, clear, hide, controls } = measure()

    expect(title.left).toBeCloseTo(box.left + padding, 0)
    expect(clear.left).toBeGreaterThan(box.left + box.width / 2)
    expect(title.right).toBeGreaterThan(box.left + box.width / 2)

    expect(hide.left - clear.right).toBeCloseTo(gap, 0)
    expect(controls.left - hide.right).toBeCloseTo(gap, 0)
    expect(controls.right).toBeCloseTo(box.right - padding, 0)
  })

  test("does the same once the panel fills the window", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "640px"

    const { element, box, gap, padding, title, clear, hide, controls } = measure()

    expect(clear.left).toBeGreaterThan(box.left + box.width / 2)
    expect(title.right).toBeGreaterThan(box.left + box.width / 2)
    expect(hide.left - clear.right).toBeCloseTo(gap, 0)
    expect(controls.left - hide.right).toBeCloseTo(gap, 0)
    expect(controls.right).toBeCloseTo(box.right - padding, 0)
    expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth)
  })
})

describe("locating an element from a full-size view", () => {
  function target() {
    const element = document.createElement("section")

    element.id = "locate-target"
    element.style.cssText = "height:200px;margin-top:3000px;background:#eee"

    document.body.appendChild(element)

    return element
  }

  function locateButton() {
    return document.querySelector('[data-herb-dev-tools-action="locate"]') as HTMLButtonElement
  }

  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement | null
  }

  test("collapses the expanded panel so the element is visible", () => {
    const element = target()
    const instance = createPanel()

    instance.report(diagnostic({ code: "sized", severity: "warning", element }))
    instance.open()
    instance.expand()

    expect(instance.expanded).toBe(true)

    locateButton().click()

    expect(instance.expanded).toBe(false)
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
    expect(document.querySelector(".herb-slot-flash")).not.toBeNull()
  })

  test("leaves a dismissible overlay so the element is visible", () => {
    const element = target()
    const instance = createPanel()

    instance.report(diagnostic({ code: "sized", severity: "warning", element, overlay: "dismissible" }))

    expect(instance.overlay).toBe("dismissible")

    locateButton().click()

    expect(instance.overlay).toBeNull()
    expect(instance.expanded).toBe(false)
    expect(document.querySelector(".herb-dev-tools-backdrop")).toBeNull()
  })

  test("never lets a blocking overlay be escaped this way", () => {
    const element = target()
    const instance = createPanel()

    instance.report(diagnostic({ code: "broke", element, overlay: "blocking" }))

    locateButton().click()

    expect(instance.overlay).toBe("blocking")
    expect(document.documentElement.style.overflow).toBe("hidden")
  })

  test("leaves a docked panel exactly where it was", () => {
    const element = target()
    const instance = createPanel()

    instance.report(diagnostic({ code: "sized", severity: "warning", element }))
    instance.open()

    locateButton().click()

    expect(instance.expanded).toBe(false)
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
    expect(document.querySelector(".herb-slot-flash")).not.toBeNull()
  })
})

describe("resizing the docked panel", () => {
  function attach() {
    const slot = document.createElement("div")

    slot.setAttribute("data-herb-dev-tools-badge-slot", "")
    document.body.appendChild(slot)
  }

  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement
  }

  function handle(edge: string) {
    return document.querySelector(`[data-herb-dev-tools-resize="${edge}"]`) as HTMLElement | null
  }

  function drag(edge: string, to: { x?: number, y?: number }) {
    const element = handle(edge)!
    const box = panel().getBoundingClientRect()

    element.setPointerCapture = () => {}
    element.releasePointerCapture = () => {}

    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: box.left, clientY: box.top }))
    element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: to.x ?? box.left, clientY: to.y ?? box.top }))
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: to.x ?? box.left, clientY: to.y ?? box.top }))
  }

  test("offers a handle on each grabbable edge while docked", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    expect(handle("left")).not.toBeNull()
    expect(handle("bottom")).not.toBeNull()
    expect(handle("corner")).not.toBeNull()
    expect(handle("top")).toBeNull()

    const corner = getComputedStyle(handle("corner")!)

    expect(corner.bottom).toBe("0px")
    expect(corner.left).toBe("0px")
    expect(corner.cursor).toBe("nesw-resize")
  })

  test("holds the right anchor while the left edge moves", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const before = panel().getBoundingClientRect()

    drag("left", { x: before.left + 60 })

    const after = panel().getBoundingClientRect()

    expect(Math.round(after.right)).toBe(Math.round(before.right))
  })

  test("never asks for more width than the viewport has", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    drag("left", { x: -400 })

    expect(panel().getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth)
  })

  test("grows the panel downward when the bottom edge is dragged down", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const before = panel().getBoundingClientRect()

    drag("bottom", { y: before.top + 260 })

    const after = panel().getBoundingClientRect()

    expect(Math.round(after.height)).toBe(260)
    expect(Math.round(after.top)).toBe(Math.round(before.top))
    expect(Math.round(after.width)).toBe(Math.round(before.width))
  })

  test("resizes both axes from the corner", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const before = panel().getBoundingClientRect()

    drag("corner", { x: before.left + 40, y: before.top + 240 })

    const after = panel().getBoundingClientRect()

    expect(Math.round(after.height)).toBe(240)
    expect(Math.round(after.right)).toBe(Math.round(before.right))
  })

  test("keeps the size across a re-render and a reload", () => {
    attach()
    const first = createPanel()

    first.report(diagnostic())
    first.open()

    const start = panel().getBoundingClientRect()

    drag("bottom", { y: start.top + 240 })

    const height = Math.round(panel().getBoundingClientRect().height)

    expect(height).toBe(240)

    first.report(diagnostic({ code: "another" }))

    expect(Math.round(panel().getBoundingClientRect().height)).toBe(height)

    first.destroy()
    document.body.innerHTML = ""

    attach()
    const second = createPanel()

    second.report(diagnostic())
    second.open()

    expect(Math.round(panel().getBoundingClientRect().height)).toBe(height)

    second.resetSize()

    expect(Math.round(panel().getBoundingClientRect().height)).not.toBe(height)
  })

  test("refuses to shrink below a usable size, or below what the viewport allows", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    drag("left", { x: window.innerWidth })

    const floor = Math.min(435, window.innerWidth - 24)

    expect(Math.round(panel().getBoundingClientRect().width)).toBe(floor)

    drag("bottom", { y: 0 })

    expect(Math.round(panel().getBoundingClientRect().height)).toBe(180)
  })

  test("offers no handles once the panel fills the window or an overlay is up", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()
    instance.expand()

    expect(handle("left")).toBeNull()

    instance.collapse()

    expect(handle("left")).not.toBeNull()

    instance.report(diagnostic({ code: "unhydrated", overlay: "dismissible" }))

    expect(handle("left")).toBeNull()
  })
})

describe("resize round trips", () => {
  function attach() {
    const slot = document.createElement("div")

    slot.setAttribute("data-herb-dev-tools-badge-slot", "")
    document.body.appendChild(slot)
  }

  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement
  }

  test("does not drift when the same size is stored and reapplied", () => {
    attach()
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const widths: number[] = []

    for (let round = 0; round < 4; round += 1) {
      const element = document.querySelector('[data-herb-dev-tools-resize="left"]') as HTMLElement

      element.setPointerCapture = () => {}

      const box = panel().getBoundingClientRect()
      const target = box.left + 10

      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: box.left, clientY: box.top }))
      element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: target, clientY: box.top }))
      element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: target, clientY: box.top }))

      instance.report(diagnostic({ code: `round-${round}` }))

      widths.push(Math.round(panel().getBoundingClientRect().width))
    }

    for (let index = 1; index < widths.length; index += 1) {
      expect(widths[index]).toBeLessThanOrEqual(widths[index - 1])
    }

    expect(new Set(widths).size).toBeGreaterThan(0)
    expect(Math.max(...widths)).toBeLessThanOrEqual(window.innerWidth)
  })
})

describe("resize drag hygiene", () => {
  test("suppresses text selection for the length of the drag", () => {
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const handle = document.querySelector('[data-herb-dev-tools-resize="left"]') as HTMLElement

    handle.setPointerCapture = () => {}

    expect(document.body.style.userSelect).toBe("")

    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }))

    expect(document.body.style.userSelect).toBe("none")

    handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: 200, clientY: 100 }))

    expect(document.body.style.userSelect).toBe("")
  })

  test("gives selection back when a drag is cancelled", () => {
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const handle = document.querySelector('[data-herb-dev-tools-resize="left"]') as HTMLElement

    handle.setPointerCapture = () => {}

    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }))
    handle.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }))

    expect(document.body.style.userSelect).toBe("")
  })

  test("gives selection back when the panel is destroyed mid-drag", () => {
    const instance = createPanel()

    instance.report(diagnostic())
    instance.open()

    const handle = document.querySelector('[data-herb-dev-tools-resize="left"]') as HTMLElement

    handle.setPointerCapture = () => {}
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }))

    instance.destroy()

    expect(document.body.style.userSelect).toBe("")
  })
})

describe("what a blocking screen calls itself", () => {
  function title() {
    return document.querySelector(".herb-dev-tools-title")!.textContent
  }

  test("says the template could not be compiled", () => {
    const instance = createPanel()

    instance.report(diagnostic({ origin: "Herb Parser", phase: "compile", overlay: "blocking" }))

    expect(title()).toBe("This template could not be compiled")
  })

  test("says templates, plural, when more than one failed", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", template: "a.html.erb", origin: "Herb Parser", phase: "compile", overlay: "blocking" }),
      diagnostic({ code: "two", template: "b.html.erb", origin: "Herb Parser", phase: "compile", overlay: "blocking" }),
    ])

    expect(title()).toBe("These templates could not be compiled")
  })

  test("keeps naming the producer for anything that did render", () => {
    const instance = createPanel()

    instance.report(diagnostic({ origin: "Herb Client Runtime", phase: "runtime", overlay: "dismissible" }))

    expect(title()).toBe("Herb Client Runtime")
  })

  test("keeps naming the producer when the phase is not said at all", () => {
    const instance = createPanel()

    instance.report(diagnostic({ origin: "Acme Scanner", overlay: "dismissible" }))

    expect(title()).toBe("Acme Scanner")
  })

  test("will not claim a compile failure for a mixed screen", () => {
    const instance = createPanel()

    instance.report([
      diagnostic({ code: "one", origin: "Herb Parser", phase: "compile", overlay: "blocking" }),
      diagnostic({ code: "two", origin: "Herb Parser", overlay: "blocking" }),
    ])

    expect(title()).toBe("Herb Parser")
  })
})

describe("one block per file", () => {
  const SOURCE = `<div class="actions">\n  <form action="/posts">\n    <button>Delete</button>\n  </form>\n</div>\n`

  function payload() {
    return {
      version: 1,
      sources: { "app/views/posts/_actions.html.erb": SOURCE },
      diagnostics: [
        {
          template: "app/views/posts/_actions.html.erb",
          message: "Nested `<form>` elements are not allowed.",
          code: "html-no-nested-forms",
          severity: "error",
          origin: "Herb Linter",
          location: { start: { line: 2, column: 3 }, end: { line: 2, column: 24 } },
        },
        {
          template: "app/views/posts/_actions.html.erb",
          message: "Button has no accessible name.",
          code: "html-button-name",
          severity: "warning",
          origin: "Herb Linter",
          location: { start: { line: 3, column: 5 }, end: { line: 3, column: 26 } },
        },
      ],
    }
  }

  function viewButton() {
    return document.querySelector('[data-herb-dev-tools-action="view"]') as HTMLButtonElement | null
  }

  function combined() {
    return document.querySelector(".herb-dev-tools-combined")
  }

  test("offers the toggle once the panel fills the window", async () => {
    embed(payload())

    const instance = createPanel()

    instance.open()

    expect(viewButton()).toBeNull()

    instance.expand()

    await waitForExcerpt()

    expect(viewButton()!.textContent).toBe("One block per file")
    expect(viewButton()!.getAttribute("aria-pressed")).toBe("false")
  })

  test("replaces the cards with a single block", async () => {
    embed(payload())

    const instance = createPanel()

    instance.open()
    instance.expand()

    await waitForExcerpt()

    expect(cards()).toHaveLength(2)
    expect(combined()).toBeNull()

    instance.toggleView()

    await waitFor(() => combined(), "the combined block")

    expect(cards()).toHaveLength(0)
    expect(document.querySelectorAll(".herb-dev-tools-combined")).toHaveLength(1)
    expect(viewButton()!.textContent).toBe("One card per offense")
  })

  test("marks every offence in the one block", async () => {
    embed(payload())

    const instance = createPanel()

    instance.open()
    instance.expand()
    instance.toggleView()

    const element = await waitFor(
      () => document.querySelector(".herb-dev-tools-combined herb-ansi") as HTMLElement | null,
      "the combined block",
    )

    const plain = element.textContent!.split("").filter(character => character.charCodeAt(0) !== 27).join("")
      .replace(/\[[0-9;]*m/g, "")

    expect(plain).toContain("Nested `<form>` elements are not allowed.")
    expect(plain).toContain("Button has no accessible name.")

    const lines = plain.split("\n")

    expect(lines.some(line => line.includes("1 \u2502 <div class=\"actions\">"))).toBe(true)
    expect(lines.some(line => line.includes("5 \u2502 </div>"))).toBe(true)
    expect(lines.filter(line => line.includes("~")).length).toBe(2)
  })

  test("keeps the cards for a file it has no source for", async () => {
    embed({ version: 1, diagnostics: payload().diagnostics })

    const instance = createPanel()

    instance.open()
    instance.expand()
    instance.toggleView()

    expect(instance.view).toBe("combined")
    expect(combined()).toBeNull()
    expect(cards()).toHaveLength(2)
    expect(viewButton()).toBeNull()
  })

  test("remembers the choice for the session", async () => {
    embed(payload())

    const first = createPanel()

    first.open()
    first.expand()
    first.toggleView()

    expect(first.view).toBe("combined")

    first.destroy()
    document.body.innerHTML = ""
    embed(payload())

    const second = createPanel()

    expect(second.view).toBe("combined")
  })
})
