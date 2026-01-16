import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import dedent from "dedent"

let formatter: Formatter

describe("herb:formatter ignore directive", () => {
  beforeAll(async () => {
    await Herb.load()
    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
  })

  test("should ignore formatting when directive is at top of file", () => {
    const source = dedent`
      <%# herb:formatter ignore %>
      <DIV>
            <SPAN>  Badly   formatted   content  </SPAN>
      </DIV>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
  })

  test("should ignore formatting when directive is in middle of file", () => {
    const source = dedent`
      <div>
        <%# herb:formatter ignore %>
        <SPAN>  Badly   formatted   content  </SPAN>
      </div>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
  })

  test("should work with frontmatter before directive", () => {
    const source = dedent`
      ---
      title: Test
      ---
      <%# herb:formatter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
  })

  test("should work with whitespace before directive", () => {
    const source = `

      <%# herb:formatter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
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
    const source = dedent`
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
      <%# herb:formatter ignore %>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
  })

  test("should ignore formatting when directive is nested deep in document", () => {
    const source = dedent`
      <DIV>
        <SECTION>
          <ARTICLE>
            <%# herb:formatter ignore %>
            <SPAN>  Badly   formatted  </SPAN>
          </ARTICLE>
        </SECTION>
      </DIV>
    `

    const result = formatter.format(source)
    expect(result).toBe(source)
  })
})
