import dedent from "dedent"
import { describe, test, beforeAll, expect } from "vitest"

import { Herb } from "@herb-tools/node"
import { HTMLOmittedCloseTagNode } from "@herb-tools/core"
import { IdentityPrinter } from "../../src/index.js"

import { expectNodeToPrint, location, createToken } from "../helpers/printer-test-helpers.js"

function expectPrintRoundTripWithNode(input: string) {
  const parseResult = Herb.parse(input, { track_whitespace: true, strict: false })
  const printer = new IdentityPrinter()
  const output = printer.print(parseResult.value, { ignoreErrors: true })

  expect(output).toBeDefined()
  expect(output).toBe(input)
}

describe("HTMLOmittedCloseTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from manually constructed node - prints nothing", () => {
    const node = HTMLOmittedCloseTagNode.from({
      type: "AST_HTML_OMITTED_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_name: createToken("TOKEN_IDENTIFIER", "p"),
    })

    expectNodeToPrint(node, "")
  })

  test("prints p element with omitted closing tag", () => {
    expectPrintRoundTripWithNode("<p>Hello World\n")
  })

  test("prints li elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ul>
        <li>Item 1
        <li>Item 2
        <li>Item 3
      </ul>
    `)
  })

  test("prints dt and dd elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <dl>
        <dt>Term 1
        <dd>Definition 1
        <dt>Term 2
        <dd>Definition 2
      </dl>
    `)
  })

  test("prints tr, td elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <table>
        <tr>
          <td>Cell 1
          <td>Cell 2
        <tr>
          <td>Cell 3
          <td>Cell 4
      </table>
    `)
  })

  test("prints option elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <select>
        <option>Option 1
        <option>Option 2
        <option>Option 3
      </select>
    `)
  })

  test("prints optgroup with omitted closing tag", () => {
    expectPrintRoundTripWithNode(dedent`
      <select>
        <optgroup label="Group 1">
          <option>Option 1
          <option>Option 2
        <optgroup label="Group 2">
          <option>Option 3
      </select>
    `)
  })

  test("prints thead, tbody, tfoot with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <table>
        <thead>
          <tr><th>Header
        <tbody>
          <tr><td>Body
        <tfoot>
          <tr><td>Footer
      </table>
    `)
  })

  test("prints colgroup with omitted closing tag", () => {
    expectPrintRoundTripWithNode(dedent`
      <table>
        <colgroup>
          <col style="width: 50%">
        <tr>
          <td>Cell
      </table>
    `)
  })

  test("prints rt and rp elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ruby>
        Base<rp>(<rt>annotation<rp>)
      </ruby>
    `)
  })

  test("prints nested elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ul>
        <li>Item with <strong>nested</strong> content
        <li>Another item
      </ul>
    `)
  })

  test("prints inline-block li elements preserving whitespace", () => {
    expectPrintRoundTripWithNode(`<ul><li style="display: inline-block">Foo<li style="display: inline-block">Bar</ul>`)
  })

  test("prints p elements followed by block elements", () => {
    expectPrintRoundTripWithNode(dedent`
      <p>First paragraph
      <div>A div interrupts</div>
      <p>Second paragraph
    `)
  })

  test("prints mixed explicit and omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ul>
        <li>Item with omitted closing tag
        <li>Another item</li>
        <li>Back to omitted
      </ul>
    `)
  })

  test("prints th elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <table>
        <tr>
          <th>Header 1
          <th>Header 2
        <tr>
          <td>Data 1
          <td>Data 2
      </table>
    `)
  })

  test("prints ERB content in elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ul>
        <li><%= item_1 %>
        <li><%= item_2 %>
      </ul>
    `)
  })

  test("prints ERB loops with elements with omitted closing tags", () => {
    expectPrintRoundTripWithNode(dedent`
      <ul>
        <% items.each do |item| %>
          <li><%= item %>
        <% end %>
      </ul>
    `)
  })
})
