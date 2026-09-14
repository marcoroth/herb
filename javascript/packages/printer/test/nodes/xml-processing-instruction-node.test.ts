import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { XMLProcessingInstructionNode, LiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("XMLProcessingInstructionNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print processing instruction from node", () => {
    const literalNode = LiteralNode.build({
      location: createLocation(),
      content: " name=\"placeholder\""
    })

    const node = XMLProcessingInstructionNode.build({
      location: createLocation(),
      tag_opening: createToken("TOKEN_XML_PROCESSING_INSTRUCTION_START", "<?"),
      target: createToken("TOKEN_IDENTIFIER", "marker"),
      children: [literalNode],
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    expectNodeToPrint(node, "<?marker name=\"placeholder\">")
  })

  test("can print processing instruction without data from node", () => {
    const node = XMLProcessingInstructionNode.build({
      location: createLocation(),
      tag_opening: createToken("TOKEN_XML_PROCESSING_INSTRUCTION_START", "<?"),
      target: createToken("TOKEN_IDENTIFIER", "end"),
      children: [],
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    expectNodeToPrint(node, "<?end>")
  })

  test("can print processing instruction from source", () => {
    expectPrintRoundTrip("<?marker name=\"placeholder\">")
  })

  test("can print processing instruction without data from source", () => {
    expectPrintRoundTrip("<?end>")
  })

  test("can print processing instruction closed with question mark from source", () => {
    expectPrintRoundTrip("<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\"?>")
  })

  test("can print processing instruction with ERB from source", () => {
    expectPrintRoundTrip("<?marker name=\"<%= placeholder_name %>\">")
  })

  test("can print processing instructions inside an element from source", () => {
    expectPrintRoundTrip(dedent`
      <div>
        <?marker name="placeholder">

        <?start name="another-placeholder">
          Loading…
        <?end>
      </div>
    `)
  })
})
