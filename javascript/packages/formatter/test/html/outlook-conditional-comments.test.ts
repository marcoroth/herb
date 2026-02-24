import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"
import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("Outlook conditional comments", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("preserves conditional comment syntax on same line - issue #877", () => {
    expectFormattedToMatch(dedent`
      <!--[if mso]>
      <center>
      <![endif]-->
    `)
  })

  test("handles conditional comment with content", () => {
    expectFormattedToMatch(dedent`
      <!--[if mso]>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>Content</td>
        </tr>
      </table>
      <![endif]-->
    `)
  })

  test("handles negated conditional comment", () => {
    expectFormattedToMatch(dedent`
      <!--[if !mso]><!-->
      <div>Not Outlook</div>
      <!--<![endif]-->
    `)
  })

  test("handles conditional comment with ERB interpolation", () => {
    expectFormattedToMatch(dedent`
      <!--[if mso]>
      <table width="<%= width %>" cellpadding="0" cellspacing="0">
        <tr>
          <td><%= content %></td>
        </tr>
      </table>
      <![endif]-->
    `)
  })
})
