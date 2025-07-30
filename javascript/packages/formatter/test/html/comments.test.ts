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

  test("HTML comment", () => {
    const source = dedent`
      <!-- hello -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- hello -->
    `)
  })

  test("HTML comment with no surrounding spaces", () => {
    const source = dedent`
      <!--hello-->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- hello -->
    `)
  })

  test("formats HTML comments and ERB comments", () => {
    const source = dedent`
      <!-- HTML Comment --><%# ERB Comment %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- HTML Comment -->
      <%# ERB Comment %>
    `)
  })
})
