import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("formats ERB comments", () => {
    const source = '<%# ERB Comment %>'
    const result = formatter.format(source)

    expect(result).toEqual(`<%# ERB Comment %>`)
  })

  test("formats multi-line ERB comment", () => {
    const source = dedent`
      <%#
        hello
        this is a
        multi-line ERB
        comment
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#
        hello
        this is a
        multi-line ERB
        comment
      %>
    `)
  })

  test("handles long ERB comments that exceed maxLineLength", () => {
    const source = '<%# herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>'

    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("handles various long ERB comment lengths", () => {
    const source80 = '<%# This comment is exactly 80 characters long and should not crash %>'
    const result80 = formatter.format(source80)
    expect(result80).toEqual(source80)

    const source100 = '<%# This is a very long ERB comment that exceeds 100 characters and should be handled gracefully %>'
    const result100 = formatter.format(source100)
    expect(result100).toEqual(source100)
  })
})
