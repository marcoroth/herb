import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { CSSStyleNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation } from "../helpers/printer-test-helpers.js"

describe("CSSStyleNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node with simple CSS", () => {
    const cssContent = dedent`
      body {
        background: white;
        color: black;
      }
    `

    const node = CSSStyleNode.from({
      type: "AST_CSS_STYLE_NODE",
      location: createLocation(),
      errors: [],
      content: cssContent,
      rules: [],
      valid: true,
      parse_error: ""
    })

    expectNodeToPrint(node, cssContent)
  })

  test("can print from node with complex CSS", () => {
    const cssContent = dedent`
      .container {
        display: flex;
        gap: 1rem;
      }

      @media (max-width: 768px) {
        .container {
          flex-direction: column;
        }
      }
    `

    const node = CSSStyleNode.from({
      type: "AST_CSS_STYLE_NODE",
      location: createLocation(),
      errors: [],
      content: cssContent,
      rules: [],
      valid: true,
      parse_error: ""
    })

    expectNodeToPrint(node, cssContent)
  })

  test("can print from source with simple style tag", () => {
    expectPrintRoundTrip(dedent`
      <style>
        body {
          background: white;
        }
      </style>
    `)
  })

  test("can print from source with media query", () => {
    expectPrintRoundTrip(dedent`
      <style>
        @media (max-width: 768px) {
          body {
            font-size: 14px;
          }
        }
      </style>
    `)
  })

  test("can print from source with CSS custom properties", () => {
    expectPrintRoundTrip(dedent`
      <style>
        :root {
          --primary-color: #007bff;
          --secondary-color: #6c757d;
        }
      </style>
    `)
  })

  test("can print empty style tag", () => {
    expectPrintRoundTrip("<style></style>")
  })
})
