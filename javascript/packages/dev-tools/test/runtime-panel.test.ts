import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import "../src/styles.css"

import { RuntimePanel, buildExcerptDocument } from "../src/runtime-panel"
import { MAX_RUNTIME_DIAGNOSTICS, normalizeDiagnostic, resetRuntimeReportWarnings } from "../src/runtime-report"

import type { CodeBlockNode } from "@herb-tools/highlighter"
import type { RuntimeDiagnostic } from "../src/runtime-report"

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
      origin: "herb-linter",
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
      origin: "herb-a11y",
      location: { start: { line: 3, column: 3 } },
    },
    {
      template: "app/views/posts/_actions.html.erb",
      node: "3",
      message: "This partial issued 3 SQL queries.",
      kind: "metric",
      origin: "herb-runtime",
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
      origin: "herb-linter",
      location: { start: { line: 2, column: 3 }, end: { line: 4, column: 10 } },
      fix,
    }],
    ...(sources === null ? {} : { sources }),
  }
}

async function waitForFix() {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const rendered = document.querySelector(".hdt-fix") as HTMLDetailsElement | null

    if (rendered !== null) {
      return rendered
    }

    await new Promise(resolve => setTimeout(resolve, 25))
  }

  throw new Error("Timed out waiting for the fix diff to hydrate")
}

let panels: RuntimePanel[] = []

function embed(payload: unknown) {
  const script = document.createElement("script")

  script.type = "application/json"
  script.setAttribute("data-herb-runtime-report", "")
  script.textContent = typeof payload === "string" ? payload : JSON.stringify(payload)

  document.body.appendChild(script)
}

function createPanel() {
  const panel = new RuntimePanel()

  panels.push(panel)

  return panel
}

function root() {
  return document.querySelector(".hdt-runtime-root") as HTMLElement | null
}

function cards() {
  return Array.from(document.querySelectorAll(".hdt-card"))
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

describe("badge", () => {
  test("docks a badge carrying the diagnostic count", () => {
    embed(PAYLOAD)
    createPanel()

    const badge = root()!.querySelector(".hdt-badge") as HTMLElement

    expect(badge).not.toBeNull()
    expect(badge.querySelector(".hdt-badge-count")!.textContent).toBe("2")
    expect(badge.textContent).toContain("⚠")
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
    expect(document.querySelectorAll(".hdt-runtime-root")).toHaveLength(1)
    expect(styles.position).toBe("fixed")
    expect(styles.pointerEvents).toBe("none")
    expect(root()!.getBoundingClientRect().width).toBeLessThan(window.innerWidth)
  })

  test("opens and closes the panel on click", () => {
    embed(PAYLOAD)
    createPanel()

    expect(document.querySelector(".hdt-panel.hdt-open")).toBeNull()

    ;(root()!.querySelector('[data-hdt-action="toggle"]') as HTMLElement).click()

    expect(document.querySelector(".hdt-panel.hdt-open")).not.toBeNull()

    ;(root()!.querySelector('[data-hdt-action="toggle"]') as HTMLElement).click()

    expect(document.querySelector(".hdt-panel.hdt-open")).toBeNull()
  })

  test("persists the open state in sessionStorage", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.open()
    panel.destroy()

    createPanel()

    expect(document.querySelector(".hdt-panel.hdt-open")).not.toBeNull()
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

    const titles = Array.from(document.querySelectorAll(".hdt-group-title")).map(node => node.textContent)

    expect(titles[0]).toContain("app/views/posts/_actions.html.erb")
    expect(titles[1]).toContain("app/views/posts/index.html.erb")
    expect(cards()).toHaveLength(3)
  })

  test("renders a severity dot, the rule code, and the suggestion", () => {
    embed(PAYLOAD)
    createPanel()

    const card = cards()[0]

    expect(card.querySelector(".hdt-dot-error")).not.toBeNull()
    expect(card.querySelector(".hdt-code")!.textContent).toBe("html-no-nested-forms")
    expect(card.querySelector(".hdt-code")!.getAttribute("href")).toBe("https://herb-tools.dev/linter/rules/html-no-nested-forms")
    expect(card.querySelector(".hdt-suggestion")!.textContent).toBe("Remove the inner form.")
  })

  test("never renders a severity dot for a metric", () => {
    embed(PAYLOAD)
    createPanel()

    const metric = document.querySelector('.hdt-card[data-hdt-kind="metric"]') as HTMLElement

    expect(metric).not.toBeNull()
    expect(metric.querySelector(".hdt-dot")).toBeNull()
    expect(metric.querySelector(".hdt-metric")!.textContent).toBe("3 SQL queries")
    expect(document.querySelectorAll(".hdt-dot-error, .hdt-dot-warning")).toHaveLength(2)
  })

  test("keeps a metric free of a severity dot even when the payload sends one", () => {
    embed({ version: 1, diagnostics: [{ template: "a.html.erb", message: "m", kind: "metric", severity: "error" }] })
    createPanel()

    expect(document.querySelector(".hdt-dot")).toBeNull()
    expect(document.querySelector(".hdt-metric")!.textContent).toBe("metric")
  })

  test("renders the render stack innermost first", () => {
    embed(PAYLOAD)
    createPanel()

    const frames = Array.from(cards()[0].querySelectorAll(".hdt-frame-target")).map(node => node.textContent)

    expect(frames).toEqual([
      "app/views/posts/_actions.html.erb:1:1",
      "app/views/posts/index.html.erb:6:10",
      "app/views/layouts/application.html.erb:7:10",
    ])

    expect(cards()[0].querySelector(".hdt-stack-order")!.textContent).toBe("innermost first")
  })

  test("attributes the second collection occurrence to its own call site", () => {
    embed(PAYLOAD)
    createPanel()

    const metric = document.querySelector('.hdt-card[data-hdt-kind="metric"]') as HTMLElement
    const frames = Array.from(metric.querySelectorAll(".hdt-frame-target")).map(node => node.textContent)

    expect(frames[1]).toBe("app/views/posts/index.html.erb:18:4")
  })

  test("renders without an excerpt when the source is unavailable", () => {
    embed(PAYLOAD)
    createPanel()

    expect(document.querySelector(".hdt-excerpt")).toBeNull()
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

    expect(document.querySelector(".hdt-body img")).toBeNull()
    expect(document.querySelector(".hdt-body script")).toBeNull()
    expect(document.querySelector(".hdt-body b")).toBeNull()
    expect(document.querySelector(".hdt-body i")).toBeNull()
    expect(document.querySelector(".hdt-message")!.textContent).toBe("<script>alert('message')</script>")
    expect(document.querySelector(".hdt-group-title")!.textContent).toContain("<img src=x onerror=alert(1)>.html.erb")
  })

  test("refuses to link a non-http docsUrl", () => {
    embed({
      version: 1,
      diagnostics: [{ template: "a.html.erb", message: "m", code: "rule", docsUrl: "javascript:alert(1)" }],
    })

    createPanel()

    const code = document.querySelector(".hdt-code")!

    expect(code.tagName).toBe("SPAN")
    expect(code.getAttribute("href")).toBeNull()
  })
})

describe("fix diffs", () => {
  test("renders a safe fix as a collapsed diff that says it was not applied", async () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()
    const summary = details.querySelector(".hdt-fix-summary")!

    expect(details.tagName).toBe("DETAILS")
    expect(details.open).toBe(false)
    expect(details.getAttribute("data-hdt-fix")).toBe("safe")
    expect(summary.textContent).toContain("Not applied")
    expect(summary.querySelector(".hdt-fix-command")!.textContent).toBe("herb lint --fix")
    expect(summary.textContent).not.toContain("unsafe")
    expect(details.querySelector(".hdt-fix-diff .herb-diff")).not.toBeNull()
    expect(details.querySelectorAll(".hdt-fix-diff .herb-diff-removed").length).toBeGreaterThan(0)
    expect(details.querySelectorAll(".hdt-fix-diff .herb-diff-added").length).toBeGreaterThan(0)
  })

  test("labels an unsafe fix differently", async () => {
    embed(fixPayload({ kind: "unsafe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()
    const summary = details.querySelector(".hdt-fix-summary")!

    expect(details.getAttribute("data-hdt-fix")).toBe("unsafe")
    expect(summary.textContent).toContain("Not applied")
    expect(summary.textContent).toContain("unsafe")
    expect(summary.querySelector(".hdt-fix-command")!.textContent).toBe("herb lint --fix-unsafely")
  })

  test("falls back to a safe label for an unrecognized kind", async () => {
    embed(fixPayload({ kind: "reckless", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()

    expect(details.getAttribute("data-hdt-fix")).toBe("safe")
    expect(details.querySelector(".hdt-fix-command")!.textContent).toBe("herb lint --fix")
  })

  test("gives the diff a foreground that differs from its background", async () => {
    embed(fixPayload({ source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    const details = await waitForFix()

    details.open = true

    const diff = details.querySelector(".hdt-fix-diff") as HTMLElement
    const styles = getComputedStyle(diff)

    expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(styles.color).not.toBe(styles.backgroundColor)

    const line = diff.querySelector(".herb-line") as HTMLElement

    expect(line).not.toBeNull()
    expect(getComputedStyle(line).color).not.toBe(styles.backgroundColor)
  })

  test("drops a fix without a string source", () => {
    embed(fixPayload({ kind: "safe" }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-fix")).toBeNull()
    expect(document.querySelector("[data-hdt-fix-pending]")).toBeNull()
  })

  test("drops a fix whose source is what the template already says", () => {
    embed(fixPayload({ kind: "safe", source: FIXABLE_SOURCE }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-fix")).toBeNull()
    expect(document.querySelector("[data-hdt-fix-pending]")).toBeNull()
  })

  test("renders the rest of the card when the template has no source", () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }, null))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-message")!.textContent).toBe("Nested `<form>` elements are not allowed.")
    expect(document.querySelectorAll(".hdt-frame")).not.toHaveLength(0)
    expect(document.querySelector(".hdt-fix")).toBeNull()
    expect(document.querySelector("[data-hdt-fix-pending]")).toBeNull()
  })

  test("renders the card before the backend resolves and fills the diff in afterwards", async () => {
    embed(fixPayload({ kind: "safe", source: FIXED_SOURCE }))

    const panel = createPanel()

    panel.open()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-badge-count")!.textContent).toBe("1")
    expect(document.querySelector(".hdt-fix")).toBeNull()
    expect(document.querySelector("[data-hdt-fix-pending]")).not.toBeNull()

    await waitForFix()

    expect(document.querySelector("[data-hdt-fix-pending]")).toBeNull()
  })
})

describe("buildExcerptDocument", () => {
  const source = "line one\nline two\nline three\nline four\nline five\nline six\nline seven\n"

  function block(overrides: Partial<RuntimeDiagnostic>) {
    const document = buildExcerptDocument(source, [{ text: source, role: { kind: "Plain" } }], normalizeDiagnostic({
      template: "a.html.erb",
      message: "m",
      ...overrides,
    })!)

    return document === null ? null : document.nodes[0] as CodeBlockNode
  }

  test("windows two lines of context around the marked range", () => {
    const node = block({ location: { start: { line: 4, column: 1 }, end: { line: 4, column: 5 } } })!

    expect(node.lines.map(line => line.number)).toEqual([2, 3, 4, 5, 6])
    expect(node.lines.filter(line => line.emphasis.kind === "Marked").map(line => line.number)).toEqual([4])
  })

  test("converts 1-based columns into 0-based marker offsets", () => {
    const node = block({ location: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } } })!
    const marked = node.lines.find(line => line.number === 1)!

    expect(marked.annotations).toEqual([{ start: 0, end: 4, severity: "error", message: null }])
  })

  test("marks a multi-line range to the end of each intermediate line", () => {
    const node = block({ location: { start: { line: 2, column: 6 }, end: { line: 4, column: 5 } } })!
    const numbers = node.lines.filter(line => line.emphasis.kind === "Marked").map(line => line.number)

    expect(numbers).toEqual([2, 3, 4])
    expect(node.lines.find(line => line.number === 2)!.annotations[0]).toEqual({ start: 5, end: 8, severity: "error", message: null })
    expect(node.lines.find(line => line.number === 3)!.annotations[0]).toEqual({ start: 0, end: 10, severity: "error", message: null })
  })

  test("focuses without marking for a metric", () => {
    const node = block({ kind: "metric", location: { start: { line: 3, column: 1 } } })!
    const focused = node.lines.find(line => line.number === 3)!

    expect(focused.emphasis).toEqual({ kind: "Focus" })
    expect(focused.annotations).toEqual([])
    expect(node.lines.some(line => line.emphasis.kind === "Marked")).toBe(false)
  })

  test("returns null without a location", () => {
    expect(block({})).toBeNull()
  })

  test("clamps a range that runs past the end of the source", () => {
    const node = block({ location: { start: { line: 900, column: 1 }, end: { line: 900, column: 4 } } })!

    expect(node.lines.every(line => line.number <= source.split("\n").length)).toBe(true)
  })
})

describe("filters", () => {
  test("offers one filter per origin plus an all filter", () => {
    embed(PAYLOAD)
    createPanel()

    const labels = Array.from(document.querySelectorAll(".hdt-filter")).map(node => node.textContent)

    expect(labels).toEqual(["All (3)", "herb-linter (1)", "herb-a11y (1)", "herb-runtime (1)"])
  })

  test("narrows the cards to one origin", () => {
    embed(PAYLOAD)
    createPanel()

    ;(document.querySelector('[data-hdt-origin="herb-a11y"]') as HTMLElement).click()

    expect(cards()).toHaveLength(1)
    expect(cards()[0].getAttribute("data-hdt-origin")).toBe("herb-a11y")
  })

  test("falls back to all origins when the filtered origin is cleared", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    ;(document.querySelector('[data-hdt-origin="herb-a11y"]') as HTMLElement).click()

    panel.clear("herb-a11y")

    expect(document.querySelector(".hdt-filter-active")!.getAttribute("data-hdt-origin")).toBe("*")
    expect(cards().length).toBeGreaterThan(0)
  })
})

describe("report", () => {
  test("pushes a diagnostic into the panel", () => {
    const panel = createPanel()

    panel.report(diagnostic({ origin: "herb-a11y", severity: "warning" }))

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-dot-warning")).not.toBeNull()
  })

  test("accepts a batch", () => {
    const panel = createPanel()

    panel.report([
      diagnostic({ message: "one", code: "a" }),
      diagnostic({ message: "two", code: "b" }),
    ])

    expect(cards()).toHaveLength(2)
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
    expect(document.querySelector(".hdt-repeat")!.textContent).toBe("×3")
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

    expect(document.querySelector(".hdt-repeat")!.textContent).toBe("×2")

    handle.dismiss()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-repeat")).toBeNull()
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
    expect(cards()[0].querySelector(".hdt-code")!.textContent).toBe("rule-5")
  })
})

describe("clear", () => {
  test("removes only one origin", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    panel.clear("herb-a11y")

    const origins = cards().map(card => card.getAttribute("data-hdt-origin"))

    expect(origins).toEqual(["herb-linter", "herb-runtime"])
  })

  test("falls back to all origins when the selected filter no longer matches anything", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    ;(document.querySelector('[data-hdt-origin="herb-linter"]') as HTMLElement).click()

    expect(cards().length).toBeGreaterThan(0)

    panel.clear()
    panel.report({ template: "app/views/posts/_post.html.erb", message: "Fresh finding", code: "demo-fresh", severity: "warning", origin: "demo-source" })

    expect(cards()).toHaveLength(1)
  })

  test("bounces the count only when a new diagnostic arrives", () => {
    embed(PAYLOAD)

    const panel = createPanel()

    expect(document.querySelector(".hdt-badge-count")!.classList.contains("hdt-bump")).toBe(false)

    panel.report({ template: "app/views/posts/_post.html.erb", message: "New one", code: "demo-bounce", severity: "warning" })

    expect(document.querySelector(".hdt-badge-count")!.classList.contains("hdt-bump")).toBe(true)

    panel.open()

    expect(document.querySelector(".hdt-badge-count")!.classList.contains("hdt-bump")).toBe(false)
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

    panel.report(diagnostic({ origin: "herb-a11y", code: "hook-rule" }))

    expect(cards()).toHaveLength(4)

    panel.clear("herb-a11y")

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

    panel.report(diagnostic({ origin: "herb-a11y", code: "hook-rule" }))

    expect(cards()).toHaveLength(4)

    document.querySelector("script[data-herb-runtime-report]")!.remove()

    embed({ version: 1, diagnostics: [{ template: "app/views/new.html.erb", message: "fresh" }] })

    panel.refresh()

    expect(cards()).toHaveLength(1)
    expect(document.querySelector(".hdt-message")!.textContent).toBe("fresh")
  })

  test("keeps the current entries when the page ships no payload", () => {
    const panel = createPanel()

    panel.report(diagnostic({ code: "hook-rule" }))
    panel.refresh()

    expect(cards()).toHaveLength(1)
  })
})
