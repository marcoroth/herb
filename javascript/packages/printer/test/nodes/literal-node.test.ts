import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { LiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, location } from "../helpers/printer-test-helpers.js"

describe("LiteralNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = LiteralNode.build({
      location,
      content: "example_content"
    })

    expectNodeToPrint(node, "example_content")
  })
})
