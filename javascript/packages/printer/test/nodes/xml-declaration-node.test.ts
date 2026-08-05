import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { XMLDeclarationNode, LiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("XMLDeclarationNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print basic XML declaration from node", () => {
    const literalNode = LiteralNode.from({
      type: "AST_LITERAL_NODE",
      location: createLocation(),
      errors: [],
      content: " version=\"1.0\""
    })

    const node = XMLDeclarationNode.from({
      type: "AST_XML_DECLARATION_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_XML_DECLARATION", "<?xml"),
      children: [literalNode],
      tag_closing: createToken("TOKEN_HTML_TAG_END", "?>")
    })

    expectNodeToPrint(node, "<?xml version=\"1.0\"?>")
  })

  test("can print XML declaration with encoding from node", () => {
    const literalNode = LiteralNode.from({
      type: "AST_LITERAL_NODE",
      location: createLocation(),
      errors: [],
      content: " version=\"1.0\" encoding=\"UTF-8\""
    })

    const node = XMLDeclarationNode.from({
      type: "AST_XML_DECLARATION_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_XML_DECLARATION", "<?xml"),
      children: [literalNode],
      tag_closing: createToken("TOKEN_HTML_TAG_END", "?>")
    })

    expectNodeToPrint(node, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
  })

  test("can print basic XML declaration from source", () => {
    expectPrintRoundTrip("<?xml version=\"1.0\"?>")
  })

  test("can print XML declaration with encoding from source", () => {
    expectPrintRoundTrip("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
  })

  test("can print XML declaration with encoding ISO-8859-1 from source", () => {
    expectPrintRoundTrip("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>")
  })

  test("can print XML declaration with standalone from source", () => {
    expectPrintRoundTrip("<?xml version=\"1.0\" standalone=\"yes\"?>")
  })

  test("can print XML declaration with all attributes from source", () => {
    expectPrintRoundTrip("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
  })

  test("can print XML declaration with spaces from source", () => {
    expectPrintRoundTrip("<?xml  version = \"1.0\"  ?>")
  })

  test("can print XML declaration with single quotes from source", () => {
    expectPrintRoundTrip("<?xml version='1.0' encoding='UTF-8'?>")
  })

  test("can print XML declaration followed by HTML from source", () => {
    expectPrintRoundTrip(dedent`
      <?xml version="1.0"?>
      <html><body>Hello</body></html>
    `)
  })
})
