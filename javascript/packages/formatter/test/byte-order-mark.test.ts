import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { BYTE_ORDER_MARK as BOM } from "@herb-tools/core"

let formatter: Formatter

describe("byte order mark", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })
  })

  test("removes a leading byte order mark", () => {
    expect(formatter.format(`${BOM}<div>hello</div>`)).toEqual("<div>hello</div>")
  })

  test("removes a leading byte order mark ahead of a doctype", () => {
    expect(formatter.format(`${BOM}<!DOCTYPE html>\n<html></html>`)).toEqual(formatter.format("<!DOCTYPE html>\n<html></html>"))
    expect(formatter.format(`${BOM}<!DOCTYPE html>\n<html></html>`).startsWith("<!DOCTYPE")).toBe(true)
  })

  test("formats the rest of the document as if the byte order mark was not there", () => {
    expect(formatter.format(`${BOM}<div>\n<span>hello</span>\n</div>`)).toEqual(formatter.format(`<div>\n<span>hello</span>\n</div>`))
  })

  test("removes a byte order mark from a document that is otherwise empty", () => {
    expect(formatter.format(BOM)).toEqual("")
  })

  test("leaves a document without a byte order mark untouched", () => {
    expect(formatter.format("<div>hello</div>")).toEqual("<div>hello</div>")
  })

  test("keeps a byte order mark that isn't at the start of the document", () => {
    expect(formatter.format(`<div>a${BOM}b</div>`)).toEqual(`<div>a${BOM}b</div>`)
  })

  test("keeps a byte order mark inside an attribute value", () => {
    expect(formatter.format(`<div title="a${BOM}b">hello</div>`)).toEqual(`<div title="a${BOM}b">hello</div>`)
  })

  test("keeps a byte order mark inside an ERB String literal", () => {
    expect(formatter.format(`<div><%= "a${BOM}b" %></div>`)).toEqual(`<div><%= "a${BOM}b" %></div>`)
  })

  test("keeps the byte order mark when the document is skipped for parse errors", () => {
    const source = `${BOM}<div>unclosed`
    const result = formatter.formatWithResult(source)

    expect(result.skipped).toEqual("parse-errors")
    expect(result.output).toEqual(source)
  })

  test("keeps the byte order mark when the document is skipped for an ignore directive", () => {
    const source = `${BOM}<%# herb:formatter ignore %>\n<div   >hello</div>\n`
    const result = formatter.formatWithResult(source)

    expect(result.skipped).toEqual("ignore-directive")
    expect(result.output).toEqual(source)
  })
})
