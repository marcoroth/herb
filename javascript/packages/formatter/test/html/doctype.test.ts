import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node"
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

  test("formats doctype", () => {
    const source = dedent`
      <!doctype html5>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!doctype html5>
    `)
  })

  test("formats doctype with ERB inside", () => {
    const source = dedent`
      <!DoCTyPe <% hello %> hello>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!DoCTyPe <% hello %> hello>
    `)
  })
})
