import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"

let formatter: Formatter

describe("Outlook conditional comments", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves conditional comment syntax on same line - issue #877", () => {
    const source = dedent`
      <!--[if mso]>
      <center>
      <![endif]-->
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("handles conditional comment with content", () => {
    const source = dedent`
      <!--[if mso]>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>Content</td>
        </tr>
      </table>
      <![endif]-->
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("handles negated conditional comment", () => {
    const source = dedent`
      <!--[if !mso]><!-->
      <div>Not Outlook</div>
      <!--<![endif]-->
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })
})
