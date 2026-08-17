import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyLiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, location } from "../helpers/printer-test-helpers.js"

describe("RubyLiteralNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print integer content", () => {
    const node = RubyLiteralNode.build({
      location,
      content: "123"
    })

    expectNodeToPrint(node, "123")
  })

  test("can print string content", () => {
    const node = RubyLiteralNode.build({
      location,
      content: "hello"
    })

    expectNodeToPrint(node, "hello")
  })

  test("can print boolean content", () => {
    const node = RubyLiteralNode.build({
      location,
      content: "true"
    })

    expectNodeToPrint(node, "true")
  })

  test("can print method call content", () => {
    const node = RubyLiteralNode.build({
      location,
      content: "@user.name"
    })

    expectNodeToPrint(node, "@user.name")
  })

  test("can print empty content", () => {
    const node = RubyLiteralNode.build({
      location,
      content: ""
    })

    expectNodeToPrint(node, "")
  })
})
