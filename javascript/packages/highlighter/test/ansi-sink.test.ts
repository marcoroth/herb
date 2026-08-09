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

describe("AnsiSink", () => {
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

  it("renders an inline document", () => {
    const result = highlighter.highlight(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] })

    expect(result).toMatchSnapshot()
  })

  it("renders a card document", () => {
    const result = highlighter.highlightDiagnostic(PATH, DIAG_MULTI, CONTENT, {
      contextLines: 1,
      optimizeHighlighting: true,
      codeUrl: "https://herb.tools/rules/parser-error",
      fileUrl: "file:///app/views/show.html.erb",
      suffix: "(fixable)",
    })

    expect(result).toMatchSnapshot()
  })
})
