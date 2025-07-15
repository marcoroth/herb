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
})
