import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { CDATANode, LiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("CDATANode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print empty CDATA section from node", () => {
    const node = CDATANode.from({
      type: "AST_CDATA_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_CDATA_START", "<![CDATA["),
      children: [],
      tag_closing: createToken("TOKEN_CDATA_END", "]]>")
    })

    expectNodeToPrint(node, "<![CDATA[]]>")
  })

  test("can print CDATA with text content from node", () => {
    const literalNode = LiteralNode.from({
      type: "AST_LITERAL_NODE",
      location: createLocation(),
      errors: [],
      content: "Hello World"
    })

    const node = CDATANode.from({
      type: "AST_CDATA_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_CDATA_START", "<![CDATA["),
      children: [literalNode],
      tag_closing: createToken("TOKEN_CDATA_END", "]]>")
    })

    expectNodeToPrint(node, "<![CDATA[Hello World]]>")
  })

  test("can print CDATA with XML-like content from node", () => {
    const literalNode = LiteralNode.from({
      type: "AST_LITERAL_NODE",
      location: createLocation(),
      errors: [],
      content: "<sender>John Smith</sender>"
    })

    const node = CDATANode.from({
      type: "AST_CDATA_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_CDATA_START", "<![CDATA["),
      children: [literalNode],
      tag_closing: createToken("TOKEN_CDATA_END", "]]>")
    })

    expectNodeToPrint(node, "<![CDATA[<sender>John Smith</sender>]]>")
  })

  test("can print empty CDATA section from source", () => {
    expectPrintRoundTrip("<![CDATA[]]>")
  })

  test("can print CDATA with text content from source", () => {
    expectPrintRoundTrip("<![CDATA[Hello World]]>")
  })

  test("can print CDATA with XML-like content from source", () => {
    expectPrintRoundTrip("<![CDATA[<sender>John Smith</sender>]]>")
  })

  test("can print CDATA with special characters from source", () => {
    expectPrintRoundTrip("<![CDATA[&lt; &gt; &amp; &#240;]]>")
  })

  test("can print CDATA with escaped characters from source", () => {
    expectPrintRoundTrip("<![CDATA[<html>&amp; &lt;div&gt;</html>]]>")
  })

  test("can print CDATA with newlines from source", () => {
    expectPrintRoundTrip(dedent`
      <![CDATA[
        Line 1
        Line 2
        Line 3
      ]]>
    `)
  })

  test("can print CDATA in XML document from source", () => {
    expectPrintRoundTrip(dedent`
      <?xml version="1.0"?>
      <root>
        <data><![CDATA[Some data here]]></data>
      </root>
    `)
  })

  test("can print CDATA with ERB content from source", () => {
    expectPrintRoundTrip("<![CDATA[<%= @variable %>]]>")
  })

  test("can print CDATA with complex ERB from source", () => {
    expectPrintRoundTrip(dedent`
      <![CDATA[
        <% if @condition %>
          <%= @content %>
        <% end %>
      ]]>
    `)
  })

  test("can print multiple CDATA sections from source", () => {
    expectPrintRoundTrip("<![CDATA[First]]><![CDATA[Second]]>")
  })

  test("can print CDATA with brackets from source", () => {
    expectPrintRoundTrip("<![CDATA[{[()]}]]>")
  })

  test("can print CDATA with spaces from source", () => {
    expectPrintRoundTrip("<![CDATA[   ]]>")
  })

  test("can print CDATA followed by HTML from source", () => {
    expectPrintRoundTrip("<![CDATA[Data]]><div>HTML</div>")
  })

  test("can print CDATA in RSS feed context from source", () => {
    expectPrintRoundTrip(dedent`
      <rss version="2.0">
        <channel>
          <item>
            <description><![CDATA[<%= article.excerpt %>]]></description>
          </item>
        </channel>
      </rss>
    `)
  })
})
