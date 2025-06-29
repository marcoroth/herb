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

  test("HTML tag with missing closing", () => {
    const source = dedent`
      <div
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
    `)
  })

  test("HTML tag with mismatched closing tag", () => {
    const source = dedent`
      <form></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <form></div>
    `)
  })

  test("HTML tag with attributes", () => {
    const source = dedent`
      <div id="hello"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="hello"></div>
    `)
  })
})
