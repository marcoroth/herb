import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
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

  test("formats multi-line ERB comment with first comment line on same line", () => {
    const source = dedent`
      <%# hello
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

  test("formats multi-line ERB comment with first comment line on same line", () => {
    const source = dedent`
      <%#   hello
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

  test("ERB Comment not trim left", () => {
    const source = dedent`
      <%#       content %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#       content %>
    `)
  })

  test("multiple ERB Comments not trim left", () => {
    const source = dedent`
      <%# level 1 %>
      <%#   level 2 %>
      <%#     level 3 %>
      <%#       level 4 %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# level 1 %>
      <%#   level 2 %>
      <%#     level 3 %>
      <%#       level 4 %>
    `)
  })

  test("ERB Comment trim right", () => {
    const source = dedent`
      <%# level 1       %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# level 1 %>
    `)
  })

  test("multiple ERB Comments trim right", () => {
    const source = dedent`
      <%# level 1       %>
      <%# level 2     %>
      <%# level 3   %>
      <%# level 4 %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# level 1 %>
      <%# level 2 %>
      <%# level 3 %>
      <%# level 4 %>
    `)
  })

  test("ERB Comment not trim left but trim tright", () => {
    const source = dedent`
      <%#       content                   %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#       content %>
    `)
  })

  test("spacing around", () => {
    const source = dedent`
      <%#comment%>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# comment %>
    `)
  })

  test("formats multi-line ERB comment with one line on first line", () => {
    const source = dedent`
      <%# hello
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# hello %>
    `)
  })

  test("formats multi-line ERB comment with one line on second line", () => {
    const source = dedent`
      <%#
        hello
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# hello %>
    `)
  })

  test("formats multi-line ERB comment with one line on second line indented", () => {
    const source = dedent`
      <%#
             hello
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# hello %>
    `)
  })

  test("formats multi-line ERB comment with one line on second line not indented", () => {
    const source = dedent`
      <%#
      hello
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# hello %>
    `)
  })

  test("formats multi-line ERB comment", () => {
    const source = dedent`
      <%#
      line 1
      line 2
            %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#
        line 1
        line 2
      %>
    `)
  })

  test("formats multi-line ERB comment", () => {
    const source = dedent`
      <%#
      line 1
      line 2 %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#
        line 1
        line 2
      %>
    `)
  })

  test("empty ERB comment", () => {
    const source = dedent`
      <%#          %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%# %>
    `)
  })

  test("empty multi-line ERB comment", () => {
    const source = dedent`
      <%#

      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#  %>
    `)
  })

  test("formats multi-line ERB comment", () => {
    const source = dedent`
      <%# Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote
      -%>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#
        Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote
      -%>
    `)
  })

  test("formats multi-line ERB comment with newlines", () => {
    const source = dedent`
      <%# this is the first line
        ${'' /* this is the add trailing whitespace */}

        this is the second line

        ${'' /* this is the add trailing whitespace */}


        this is the last line

        ${'' /* this is the add trailing whitespace */}
      -%>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%#
        this is the first line


        this is the second line




        this is the last line
      -%>
    `)
  })

  test("handles long ERB comments that exceed maxLineLength", () => {
    expectFormattedToMatch('<%# herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>')
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
