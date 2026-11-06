import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"

const LONG = "a".repeat(80)

let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("multiline elements glued to their previous sibling", () => {
  beforeAll(async () => {
    await Herb.load()

    expectFormattedToMatch = createExpectFormattedToMatch(new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 }))
  })

  test("breaks the attributes of an input glued to an ERB tag onto their own lines", () => {
    expectFormattedToMatch(dedent`
      <label>
        <%= icon %><input
          type="search"
          name="${LONG}"
        >
      </label>
    `)
  })

  test("breaks the attributes of an input glued to an inline element", () => {
    expectFormattedToMatch(dedent`
      <label>
        <small>Name</small><input
          type="search"
          name="${LONG}"
        >
      </label>
    `)
  })

  test("breaks the attributes and body of a link glued to another link", () => {
    expectFormattedToMatch(dedent`
      <div>
        <a href="/short">Open</a><a
          class="button"
          href="${LONG}"
        >
          Long
        </a>
      </div>
    `)
  })
})
