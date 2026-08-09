import { describe, test, expect, beforeAll, beforeEach } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "../src/highlighter.js"
import { renderDocumentHTML, wrapDocumentHTML } from "../src/html-sink.js"
import { generateStylesheet } from "../src/stylesheet.js"
import { themes } from "../src/themes.js"

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

const OVERLAP_CONTENT = "<div id=\"x\">text</div>"

const DIAG_OVERLAP_ERROR: Diagnostic = {
  severity: "error",
  location: {
    start: { line: 1, column: 5 },
    end: { line: 1, column: 12 },
  },
  message: "first",
}

const DIAG_OVERLAP_WARNING: Diagnostic = {
  severity: "warning",
  location: {
    start: { line: 1, column: 8 },
    end: { line: 1, column: 16 },
  },
  message: "second",
}

const DIAG_UNSAFE: Diagnostic = {
  severity: "error",
  location: {
    start: { line: 2, column: 2 },
    end: { line: 2, column: 6 },
  },
  message: "bad <img> in `attr`",
  code: "unsafe-rule",
}

describe("HTMLDiagnostic", () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(async () => {
    highlighter = new Highlighter("onedark")
    await highlighter.initialize()
  })

  test("renders an inline diagnostics document with span markers", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] })
    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  test("renders an inline diagnostics document with highlight api markers", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] })
    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "highlight-api" })

    expect(result).toMatchSnapshot()
  })

  test("renders a card document", () => {
    const document = highlighter.buildCard(PATH, DIAG_MULTI, CONTENT, {
      contextLines: 1,
      optimizeHighlighting: true,
      codeUrl: "https://herb.tools/rules/parser-error",
      fileUrl: "file:///app/views/show.html.erb",
      suffix: "(fixable)",
    })

    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  test("renders a split document with progress rules", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, {
      diagnostics: [DIAG_MULTI, DIAG_WARN],
      splitDiagnostics: true,
      contextLines: 1,
    })

    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  test("escapes markup in messages and rejects unsafe urls", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, {
      diagnostics: [DIAG_UNSAFE],
      codeUrlBuilder: () => "javascript:alert(1)",
    })

    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  test("overlapping markers use the highest severity", () => {
    const document = highlighter.buildDocument(PATH, OVERLAP_CONTENT, {
      diagnostics: [DIAG_OVERLAP_ERROR, DIAG_OVERLAP_WARNING],
    })

    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  test("wraps a document with chrome and hydration", () => {
    const document = highlighter.buildDocument(PATH, CONTENT, { diagnostics: [DIAG_MULTI, DIAG_WARN] })
    const fragment = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "highlight-api" })
    const result = wrapDocumentHTML(fragment, generateStylesheet(themes.onedark, "onedark"), true)

    expect(result).toMatchSnapshot()
  })
})
