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

  test("formats <ul>", () => {
    const source = dedent`
      <ul>
      <li>List Item 1</li>
      <li>List Item 2</li>
      <li>List Item 3</li>
      <li>List Item 4</li>
      </ul>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <ul>
        <li>List Item 1</li>
        <li>List Item 2</li>
        <li>List Item 3</li>
        <li>List Item 4</li>
      </ul>
    `)
  })

  test("formats <ol>", () => {
    const source = dedent`
      <ol>
      <li>List Item 1</li>
      <li>List Item 2</li>
      <li>List Item 3</li>
      <li>List Item 4</li>
      </ol>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <ol>
        <li>List Item 1</li>
        <li>List Item 2</li>
        <li>List Item 3</li>
        <li>List Item 4</li>
      </ol>
    `)
  })
})
