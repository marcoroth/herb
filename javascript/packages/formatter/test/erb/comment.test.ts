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
    const source = `<%# ERB Comment %>`
    const result = formatter.format(source)

    expect(result).toEqual(source)
  })

  test("adds whitespace around ERB comments", () => {
    const source = `<%#ERB Comment%>`
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

  test("handles specific ERB comment patterns", () => {
    const sourceRepeatedX = '<%# x x x x x x x x x x x x %>'
    const resultRepeatedX = formatter.format(sourceRepeatedX)
    expect(resultRepeatedX).toEqual(sourceRepeatedX)

    const sourceRepeatedXInERB = '<% # x x x x x x x x x x x x %>'
    const resultRepeatedXInERB = formatter.format(sourceRepeatedXInERB)
    expect(resultRepeatedXInERB).toEqual(sourceRepeatedXInERB)

    const sourceRepeatedLsp = '<%# herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>'
    const resultRepeatedLsp = formatter.format(sourceRepeatedLsp)
    expect(resultRepeatedLsp).toEqual(sourceRepeatedLsp)
  })

  test("handles ERB comments with special characters and Unicode", () => {
    const sourceSpecialChars = '<%# Special chars: <>&"\'=+{} %>'
    const resultSpecialChars = formatter.format(sourceSpecialChars)
    expect(resultSpecialChars).toEqual(sourceSpecialChars)

    const sourceUnicode = '<%# Unicode: 🚀✨💎 — dash and \'quotes\' %>'
    const resultUnicode = formatter.format(sourceUnicode)
    expect(resultUnicode).toEqual(sourceUnicode)
  })

  test("handles ERB comments in different contexts", () => {
    const sourceWithHTML = dedent`
      <div class="container">
        <%# This is a comment before content %>
        <p>Some content</p>
        <%# This is a comment after content %>
      </div>
    `
    const resultWithHTML = formatter.format(sourceWithHTML)
    expect(resultWithHTML).toEqual(sourceWithHTML)

    const sourceNestedInAttributes = dedent`
      <div
        <%# attribute comment %>
        class="test"
        <%# another attribute comment %>
        id="example">
        Content
      </div>
    `
    const result = formatter.format(sourceNestedInAttributes)

    expect(result).toEqual(dedent`
      <div <%# attribute comment %> class="test" <%# another attribute comment %> id="example">
        Content
      </div>
    `)
  })

  test("handles multi-line ERB comments with varying indentation", () => {
    const sourceIndented = dedent`
      <div>
        <%#
          This is a multi-line comment
          with proper indentation
          and multiple lines
        %>
        <p>Content</p>
      </div>
    `
    const resultIndented = formatter.format(sourceIndented)

    expect(resultIndented).toEqual(dedent`
      <div>
        <%#
          This is a multi-line comment
          with proper indentation
          and multiple lines
        %>
        <p>Content</p>
      </div>
    `)
  })

  test("handles multi-line ERB comments with empty lines and long content", () => {
    const source = dedent`
      <h1>
        <%#

        herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>
      </h1>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <h1>
        <%#

          herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp
        %>
      </h1>
    `)
  })

  test("handles multi-line ERB comments with multiple empty lines and wrapped content", () => {
    const source = dedent`
      <h1>
        <%#

        herb lsp herb lsp herb lsp herb lsp herb lsp herb

        lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %></h1>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <h1>
        <%#

          herb lsp herb lsp herb lsp herb lsp herb lsp herb

          lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp
        %>
      </h1>
    `)
  })

  test("handles single-line ERB comment that starts inline and continues multi-line", () => {
    const source = dedent`
      <h1>
        <%# one
          two
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <h1>
        <%#
          one
          two
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `)
  })

  test("TODO", () => {
    const source = dedent`
    <h1>
      <%# one
          one
          two
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <h1>
        <%#
          one
          one
          two
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `)
  })

  test("TODO", () => {
    const source = dedent`
    <h1>
      <%# one
          two
          one
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <h1>
        <%#
          one
          two
          one
          three
          four
          five
          six
          seven
          eight
          nine
          ten
          eleven
          twelve
          thirteen
        %>
      </h1>
    `)
  })
})
