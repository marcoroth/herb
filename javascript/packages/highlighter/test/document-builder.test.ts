import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "../src/highlighter.js"

import type { Diagnostic } from "@herb-tools/core"

const PATH = "app/views/users/show.html.erb"
const CONTENT = "<div>\n  <%= user.name %>\n  <p>hello</p>\n  <span>world</span>\n</div>"

const DIAG_MULTI: Diagnostic = {
  severity: "error",
  location: {
    start: { line: 2, column: 2 },
    end: { line: 3, column: 6 },
  },
  message: "unclosed `<%=` tag",
  code: "parser-error",
}

const DIAG_WARN: Diagnostic = {
  severity: "warning",
  location: {
    start: { line: 4, column: 2 },
    end: { line: 4, column: 8 },
  },
  message: "avoid inline spans",
}

describe("DocumentBuilder", () => {
  let highlighter: Highlighter
  let originalNoColor: string | undefined

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(async () => {
    originalNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR

    highlighter = new Highlighter("onedark")
    await highlighter.initialize()
  })

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }
  })

  it("builds a file document", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, {})

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds a plain document", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { showLineNumbers: false })

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds a focus document", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { focusLine: 3, contextLines: 1 })

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds an inline diagnostics document", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] })

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds a card document", () => {
    const document = highlighter.buildCard(PATH, DIAG_MULTI, CONTENT, {
      contextLines: 1,
      optimizeHighlighting: true,
      codeUrl: "https://herb.tools/rules/parser-error",
      fileUrl: "file:///app/views/show.html.erb",
      suffix: "(fixable)",
    })

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds a split document", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, {
      diagnostics: [DIAG_MULTI, DIAG_WARN],
      splitDiagnostics: true,
      contextLines: 1,
    })

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds an empty content document", () => {
    const document = highlighter.buildDocument(PATH, "", {})

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("json is independent of color state", () => {
    const withColor = JSON.stringify(
      highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] }),
      null,
      2,
    )

    process.env.NO_COLOR = "1"

    const withoutColor = JSON.stringify(
      highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] }),
      null,
      2,
    )

    expect(withoutColor).toBe(withColor)
  })
})
