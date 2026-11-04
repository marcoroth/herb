import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("ERB in the open tag of a void element in text flow", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("keeps a conditional attribute on an input glued to text", () => {
    expectFormattedToMatch(dedent`
      <label>
        One<input type="password" <% if required %> required <% end %>>
      </label>
    `)
  })

  test("keeps a conditional attribute written without spaces around it", () => {
    const source = `<label>One<input type="password"<% if required %> required<% end %>></label>`

    expect(formatter.format(source)).toEqual(dedent`
      <label>
        One<input type="password" <% if required %> required <% end %>>
      </label>
    `)
  })

  test("keeps a conditional attribute on a self-closing element glued to text", () => {
    expectFormattedToMatch(dedent`
      <label>
        One<input type="password" <% if required %> required <% end %> />
      </label>
    `)
  })

  test("keeps ERB output and a conditional attribute together", () => {
    expectFormattedToMatch(dedent`
      <label>
        One<input <%= attributes %> type="password" <% if required %> required <% end %>>
      </label>
    `)
  })
})
