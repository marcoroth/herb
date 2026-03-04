import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"
import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("herb:formatter ignore directive", () => {
  beforeAll(async () => {
    await Herb.load()
    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("should ignore formatting when directive is at top of file", () => {
    expectFormattedToMatch(dedent`
      <%# herb:formatter ignore %>
      <DIV>
            <SPAN>  Badly   formatted   content  </SPAN>
      </DIV>
    `)
  })

  test("should ignore formatting when directive is in middle of file", () => {
    expectFormattedToMatch(dedent`
      <div>
        <%# herb:formatter ignore %>
        <SPAN>  Badly   formatted   content  </SPAN>
      </div>
    `)
  })

  test("should work with frontmatter before directive", () => {
    expectFormattedToMatch(dedent`
      ---
      title: Test
      ---
      <%# herb:formatter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("should work with whitespace before directive", () => {
    expectFormattedToMatch(`

      <%# herb:formatter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("should not match herb:formatter ignore with extra text", () => {
    const source = dedent`
      <%# herb:formatter ignore some-rule %>
      <div>
        <span>content</span>
      </div>
    `

    const result = formatter.format(source)
    expect(result).not.toBe(source)
  })

  test("should not match herb:disable all", () => {
    const source = dedent`
      <%# herb:disable all %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `

    const result = formatter.format(source)
    expect(result).not.toBe(source)
  })

  test("should ignore formatting when directive is at end of file", () => {
    expectFormattedToMatch(dedent`
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
      <%# herb:formatter ignore %>
    `)
  })

  test("should ignore formatting when directive is nested deep in document", () => {
    expectFormattedToMatch(dedent`
      <DIV>
        <SECTION>
          <ARTICLE>
            <%# herb:formatter ignore %>
            <SPAN>  Badly   formatted  </SPAN>
          </ARTICLE>
        </SECTION>
      </DIV>
    `)
  })
})
