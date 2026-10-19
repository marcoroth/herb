import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode, HTMLOptionalAttributeNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken, createLiteralNode } from "../helpers/printer-test-helpers.js"

const attribute = HTMLAttributeNode.build({
  location,
  name: HTMLAttributeNameNode.build({
    location,
    children: [
      createLiteralNode("title")
    ]
  }),
  equals: createToken("TOKEN_EQUALS", "="),
  value: HTMLAttributeValueNode.build({
    location,
    open_quote: createToken("TOKEN_QUOTE", `"`),
    close_quote: createToken("TOKEN_QUOTE", `"`),
    children: [
      createLiteralNode("value")
    ],
    quoted: true
  })
})

describe("HTMLOptionalAttributeNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints the attribute it holds", () => {
    const node = HTMLOptionalAttributeNode.build({
      location,
      attribute,
      conversion: "tag"
    })

    expectNodeToPrint(node, `title="value"`)
  })
})
