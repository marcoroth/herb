import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("line-breaking elements in text flow", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("keeps consecutive <br> tags on their own lines before text with ERB", () => {
    const source = dedent`
      <br>
      <br>
      y and <%= @z %>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("splits glued <br> tags before text with ERB and stays stable", () => {
    const source = dedent`
      <br><br>
      y and <%= @z %>
    `

    const expected = dedent`
      <br>
      <br>
      y and <%= @z %>
    `

    expect(formatter.format(source)).toEqual(expected)
    expectFormattedToMatch(expected, { passes: 2 })
  })

  test("keeps consecutive <br> tags on their own lines without following text", () => {
    const source = dedent`
      <br>
      <br>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("preserves the line break between text with ERB and a following <br>", () => {
    const source = dedent`
      y and <%= @z %>
      <br>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("keeps a <br> glued to preceding ERB output when the source has no whitespace", () => {
    const source = dedent`
      y and <%= @z %><br>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("preserves the line break between text and a following <hr>", () => {
    const source = dedent`
      x
      <hr>
      y and <%= @z %>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("keeps consecutive <br> tags on their own lines inside an element", () => {
    const source = dedent`
      <p>
        <br>
        <br>
        y and <%= @z %>
      </p>
    `

    expectFormattedToMatch(source, { passes: 2 })
  })

  test("breaks the line after a <br> glued between text", () => {
    const source = dedent`
      a<br>b and <%= @z %>
    `

    const expected = dedent`
      a<br>
      b and <%= @z %>
    `

    expect(formatter.format(source)).toEqual(expected)
    expectFormattedToMatch(expected, { passes: 2 })
  })
})
