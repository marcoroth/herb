import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import { RuntimePanel, escapeHTML, inlineCodeHTML, safeUrl } from "../src/runtime/panel"
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

const ANSI_ESCAPES = /\u001b\[[0-9;]*m/g

function plain(element: HTMLElement) {
  return (element.textContent ?? "").replace(ANSI_ESCAPES, "")
}

function waitForExcerpt() {
  return waitFor(() => document.querySelector(".herb-dev-tools-excerpt herb-ansi") as HTMLElement | null, "the excerpt to hydrate")
}

let panels: RuntimePanel[] = []

function embed(payload: unknown) {
  const script = document.createElement("script")

  script.type = "application/json"
  script.setAttribute("data-herb-runtime-report", "")
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

  test("explains itself instead of vanishing when everything goes", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    clearButton()!.click()

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

  test("escapes every HTML significant character", () => {
    expect(escapeHTML(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;")
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
    const summary = document.querySelector(".herb-dev-tools-summary") as HTMLElement

    const neutral = {
      band: getComputedStyle(header).backgroundColor,
      border: getComputedStyle(header).borderBottomColor,
      title: getComputedStyle(title).color,
      summary: getComputedStyle(summary).color,
    }

    expect(neutral.band).toBe("rgb(249, 250, 251)")
    expect(neutral.border).toBe("rgb(229, 231, 235)")
    expect(neutral.title).toBe("rgb(17, 24, 39)")
    expect(neutral.summary).toBe("rgb(107, 114, 128)")

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

  test("keeps the summary readable in the anchored header", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "560px"

    const headerElement = document.querySelector(".herb-dev-tools-header") as HTMLElement
    const header = headerElement.getBoundingClientRect()
    const close = document.querySelector(".herb-dev-tools-close")!.getBoundingClientRect()
    const summary = document.querySelector(".herb-dev-tools-summary")!.getBoundingClientRect()

    expect(headerElement.scrollWidth).toBeLessThanOrEqual(headerElement.clientWidth)
    expect(close.right).toBeLessThanOrEqual(header.right + 1)
    expect(summary.right).toBeLessThanOrEqual(header.right)
    expect(summary.width).toBeGreaterThan(60)
  })

  test("gives the summary away before the controls when the panel is narrow", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    ;(document.querySelector(".herb-dev-tools-panel") as HTMLElement).style.width = "360px"

    const headerElement = document.querySelector(".herb-dev-tools-header") as HTMLElement

    expect(headerElement.scrollWidth).toBeLessThanOrEqual(headerElement.clientWidth)

    const close = document.querySelector(".herb-dev-tools-close")!.getBoundingClientRect()
    const clear = document.querySelector(".herb-dev-tools-clear")!.getBoundingClientRect()

    expect(close.width).toBe(26)
    expect(clear.width).toBeGreaterThan(0)
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

  test("collapses on Escape and stops listening once collapsed", () => {
    embed(PAYLOAD)

    const instance = createPanel()

    instance.open()
    instance.expand()

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(instance.expanded).toBe(false)

    const remove = vi.spyOn(document, "removeEventListener")

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(instance.expanded).toBe(false)
    expect(remove).not.toHaveBeenCalledWith("keydown", expect.anything())
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

    const labels = Array.from(document.querySelectorAll(".herb-dev-tools-filter")).map(node => node.textContent)

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

  test("ignores an entry without a template or message", () => {
    const panel = createPanel()

    panel.report([{ message: "no template" } as RuntimeDiagnostic])

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

describe("refresh", () => {
  test("replaces the entries from a fresh payload", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.report(diagnostic({ origin: "Acme Scanner", code: "hook-rule" }))

    expect(cards()).toHaveLength(4)

    document.querySelector("script[data-herb-runtime-report]")!.remove()

    embed({ version: 1, diagnostics: [{ template: "app/views/new.html.erb", message: "fresh" }] })

    panel.refresh()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".herb-dev-tools-message")!.textContent).toBe("fresh")
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
