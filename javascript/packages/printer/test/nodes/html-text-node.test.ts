import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLTextNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location } from "../helpers/printer-test-helpers.js"

describe("HTMLTextNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLTextNode.from({
      type: "AST_HTML_TEXT_NODE",
      location,
      errors: [],
      content: "example_content"
    })

    expectNodeToPrint(node, "example_content")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`Text`)
    expectPrintRoundTrip(`Text             Space`)
    expectPrintRoundTrip(`Text             Space\n\n  Newlines`)
    expectPrintRoundTrip(`+"*ç%&/()=?!$àöü,.-±“#Ç[]|{}≠¿´‘¶`)
    expectPrintRoundTrip(`<h1>+"*ç%&/()=?!$àöü,.-±“#Ç[]|{}≠¿´‘¶</h1>`)
  })
})
