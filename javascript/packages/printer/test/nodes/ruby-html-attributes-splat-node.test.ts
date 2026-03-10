import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyHTMLAttributesSplatNode } from "@herb-tools/core"

import { expectNodeToPrint, location } from "../helpers/printer-test-helpers.js"

describe("RubyHTMLAttributesSplatNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print double splat", () => {
    const node = RubyHTMLAttributesSplatNode.from({
      type: "AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE",
      location,
      errors: [],
      content: "**options",
      prefix: ""
    })

    expectNodeToPrint(node, "**options")
  })

  test("can print splat with variable", () => {
    const node = RubyHTMLAttributesSplatNode.from({
      type: "AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE",
      location,
      errors: [],
      content: "**html_attrs",
      prefix: ""
    })

    expectNodeToPrint(node, "**html_attrs")
  })

  test("can print splat with method call", () => {
    const node = RubyHTMLAttributesSplatNode.from({
      type: "AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE",
      location,
      errors: [],
      content: "**data_attributes(user)",
      prefix: ""
    })

    expectNodeToPrint(node, "**data_attributes(user)")
  })

  test("can print with prefix", () => {
    const node = RubyHTMLAttributesSplatNode.from({
      type: "AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE",
      location,
      errors: [],
      content: "**options",
      prefix: "data"
    })

    expectNodeToPrint(node, "**options")
  })
})
