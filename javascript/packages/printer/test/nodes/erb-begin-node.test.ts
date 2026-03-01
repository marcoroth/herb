import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBBeginNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createToken, location, end_node, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBBeginNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print with begin/end", () => {
    const node = ERBBeginNode.from({
      type: "AST_ERB_BEGIN_NODE",
      location,
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " begin "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      errors: [],
      statements: [],
      rescue_clause: null,
      else_clause: null,
      ensure_clause: null,
      end_node
    })

    expectNodeToPrint(node, `<% begin %><% end %>`)
  })

  test("can print with begin/end and statements", () => {
    const node = ERBBeginNode.from({
      type: "AST_ERB_BEGIN_NODE",
      location,
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " begin "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      errors: [],
      statements: [createTextNode("\n  Hello\n")],
      rescue_clause: null,
      else_clause: null,
      ensure_clause: null,
      end_node
    })

    expectNodeToPrint(node, dedent`
      <% begin %>
        Hello
      <% end %>
    `)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% begin %><% end %>`)
    expectPrintRoundTrip(`<% begin %>Text<% end %>`)
    expectPrintRoundTrip(`<% begin %>    <% end %>`)

    expectPrintRoundTrip(`<% begin %><% recue %><% end %>`)
    expectPrintRoundTrip(`<% begin %><% recue A %><% recue B %><% end %>`)
    expectPrintRoundTrip(`<% begin %><% recue A %><% recue B %><% ensure %><% end %>`)

    expectPrintRoundTrip(dedent`
      <% begin %>
        <h1>begin</h1>
      <% recue ErrorA => e %>
        <h1>hello</h1>
      <% end %>
    `)

    expectPrintRoundTrip(dedent`
      <% begin %>
                  124
      <% recue ErrorA => a %>
        <h1>123</h1>
      <% recue ErrorB => b %>
        <!-- comment -->
      <% ensure %>
        345
      <% end %>
    `)
  })

  test("can print from source with invalid syntax", () => {
    expectPrintRoundTrip(`<% begin %>`, false)

    expectPrintRoundTrip(dedent`
      <% begin %>
      <% else %>
      <% end %>
    `, false)

    expectPrintRoundTrip(dedent`
      <% begin %>
          Indented
        <% else %>
              Text
      <% end %>
    `, false)
  })
})
