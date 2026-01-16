import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import dedent from "dedent"

let formatter: Formatter

describe("Tag grouping for head elements", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("groups 5+ meta tags without blank lines in head", () => {
    const source = dedent`
      <html>
        <head>
          <meta name="example1" content="value">
          <meta name="example2" content="value">
          <meta name="example3" content="value">
          <meta name="example4" content="value">
          <meta name="example5" content="value">
        </head>
      </html>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <html>
        <head>
          <meta name="example1" content="value">
          <meta name="example2" content="value">
          <meta name="example3" content="value">
          <meta name="example4" content="value">
          <meta name="example5" content="value">
        </head>
      </html>
    `)
  })

  test("adds spacing between different tag groups in head", () => {
    const source = dedent`
      <html>
        <head>
          <meta name="example1" content="value">
          <meta name="example2" content="value">
          <meta name="example3" content="value">
          <link rel="stylesheet" href="style1.css">
          <link rel="stylesheet" href="style2.css">
          <link rel="stylesheet" href="style3.css">
        </head>
      </html>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <html>
        <head>
          <meta name="example1" content="value">
          <meta name="example2" content="value">
          <meta name="example3" content="value">

          <link rel="stylesheet" href="style1.css">
          <link rel="stylesheet" href="style2.css">
          <link rel="stylesheet" href="style3.css">
        </head>
      </html>
    `)
  })
})
