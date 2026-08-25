import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLNoLiteralNBSPRule } from "../../src/rules/html-no-literal-nbsp.js"

const NBSP = "\u00A0"

let linter: Linter

describe("html-no-literal-nbsp autofix", () => {
  beforeAll(async () => {
    await Herb.load()

    linter = new Linter(Herb, [HTMLNoLiteralNBSPRule])
  })

  test("replaces a non-breaking space in text content", () => {
    const result = linter.autofix(`<div>hello${NBSP}there</div>`, { fileName: "test.html.erb" })

    expect(result.source).toBe("<div>hello&nbsp;there</div>")
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("replaces a non-breaking space in an attribute value", () => {
    const result = linter.autofix(`<div title="a${NBSP}b">hello</div>`, { fileName: "test.html.erb" })

    expect(result.source).toBe(`<div title="a&nbsp;b">hello</div>`)
    expect(result.fixed).toHaveLength(1)
  })

  test("replaces every occurrence in the same node and counts them all as fixed", () => {
    const result = linter.autofix(`<div>a${NBSP}b${NBSP}c</div>`, { fileName: "test.html.erb" })

    expect(result.source).toBe("<div>a&nbsp;b&nbsp;c</div>")
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("leaves a non-breaking space inside a script element alone", () => {
    const source = `<script>var total =${NBSP}1</script>`
    const result = linter.autofix(source, { fileName: "test.html.erb" })

    expect(result.source).toBe(source)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not modify a document without a literal non-breaking space", () => {
    const source = "<div>hello&nbsp;there</div>"
    const result = linter.autofix(source, { fileName: "test.html.erb" })

    expect(result.source).toBe(source)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("the fixed output no longer reports an offense", () => {
    const result = linter.autofix(`<div>a${NBSP}b</div>`, { fileName: "test.html.erb" })

    expect(linter.lint(result.source, { fileName: "test.html.erb" }).offenses).toHaveLength(0)
  })
})
