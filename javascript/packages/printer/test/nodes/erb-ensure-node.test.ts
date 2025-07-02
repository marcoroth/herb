import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBEnsureNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBEnsureNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBEnsureNode.from({
      type: "AST_ERB_ENSURE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " ensure "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  hello")
      ]
    })

    expectNodeToPrint(node, dedent`
      <% ensure %>
        hello
    `)
  })
})
