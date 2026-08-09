import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "../src/highlighter.js"
import { computeDiffHunks } from "../src/diff-computer.js"
import { renderDocumentHTML } from "../src/html-sink.js"

const PATH = "app/views/users/show.html.erb"

const DIFF_BEFORE = "<div>\n  <p>one</p>\n  <p>two</p>\n  <span>tail</span>\n</div>"
const DIFF_AFTER = "<div>\n  <p>one</p>\n  <p>tres</p>\n  <span>tail</span>\n</div>"

const TWO_HUNK_BEFORE = "<ul>\n  <li>a</li>\n  <li>b</li>\n  <li>c</li>\n  <li>d</li>\n  <li>e</li>\n  <li>f</li>\n  <li>g</li>\n</ul>"
const TWO_HUNK_AFTER = "<ul>\n  <li>A</li>\n  <li>b</li>\n  <li>c</li>\n  <li>d</li>\n  <li>e</li>\n  <li>f</li>\n  <li>G</li>\n</ul>"

describe("DiffDocument", () => {
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

  it("builds a diff document", () => {
    const document = highlighter.buildDiff(PATH, DIFF_BEFORE, DIFF_AFTER)

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds a diff document from hunks", () => {
    const hunks = computeDiffHunks(DIFF_BEFORE, DIFF_AFTER, 2)
    const document = highlighter.buildDiffFromHunks(PATH, hunks)

    expect(JSON.stringify(document, null, 2)).toMatchSnapshot()
  })

  it("builds an empty document for identical content", () => {
    const document = highlighter.buildDiff(PATH, DIFF_BEFORE, DIFF_BEFORE)

    expect(document.nodes).toEqual([])
  })

  it("renders a unified diff", () => {
    const document = highlighter.buildDiff(PATH, TWO_HUNK_BEFORE, TWO_HUNK_AFTER, { contextLines: 1 })
    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  it("renders a split diff with columns", () => {
    const document = highlighter.buildDiff(PATH, TWO_HUNK_BEFORE, TWO_HUNK_AFTER, { contextLines: 1 })
    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans", diffLayout: "split" })

    expect(result).toMatchSnapshot()
  })

  it("renders inline change marks", () => {
    const document = highlighter.buildDiff(PATH, DIFF_BEFORE, DIFF_AFTER)
    const result = renderDocumentHTML(document, { themeLabel: "onedark", showLineNumbers: true, markers: "spans" })

    expect(result).toMatchSnapshot()
  })

  it("ansi diff is byte identical through the document path", () => {
    expect(highlighter.highlightDiff(PATH, DIFF_BEFORE, DIFF_AFTER)).toMatchSnapshot()
    expect(highlighter.highlightDiff(PATH, DIFF_BEFORE, DIFF_AFTER, { singleLineStyle: "inline" })).toMatchSnapshot()
  })
})
