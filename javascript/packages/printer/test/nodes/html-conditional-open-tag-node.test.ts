import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLConditionalOpenTagNode, ERBIfNode, ERBElseNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, end_node, createToken, createTextNode } from "../helpers/printer-test-helpers.js"
import { HTMLOpenTagNode } from "@herb-tools/core"

describe("HTMLConditionalOpenTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from manually constructed node", () => {
    const open_tag_a = HTMLOpenTagNode.from({
      type: "AST_HTML_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [],
      is_void: false
    })

    const open_tag_b = HTMLOpenTagNode.from({
      type: "AST_HTML_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [],
      is_void: false
    })

    const else_node = ERBElseNode.from({
      type: "AST_ERB_ELSE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " else "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  "),
        open_tag_b,
        createTextNode("\n")
      ]
    })

    const if_node = ERBIfNode.from({
      type: "AST_ERB_IF_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " if condition "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  "),
        open_tag_a,
        createTextNode("\n")
      ],
      subsequent: else_node,
      end_node
    })

    const node = HTMLConditionalOpenTagNode.from({
      type: "AST_HTML_CONDITIONAL_OPEN_TAG_NODE",
      location,
      errors: [],
      conditional: if_node,
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      is_void: false
    })

    expectNodeToPrint(node, dedent`
      <% if condition %>
        <div>
      <% else %>
        <div>
      <% end %>
    `)
  })

  test("prints simple if/else conditional open tag", () => {
    expectPrintRoundTrip(dedent`
      <% if some_condition %>
        <div class="a">
      <% else %>
        <div class="b">
      <% end %>
        Content
      </div>
    `)
  })

  test("prints if/elsif/else conditional open tag", () => {
    expectPrintRoundTrip(dedent`
      <% if condition_a %>
        <div class="a">
      <% elsif condition_b %>
        <div class="b">
      <% else %>
        <div class="c">
      <% end %>
        Content
      </div>
    `)
  })

  test("prints unless/else conditional open tag", () => {
    expectPrintRoundTrip(dedent`
      <% unless hide_wrapper %>
        <section class="wrapper">
      <% else %>
        <section class="minimal">
      <% end %>
        <p>Content</p>
      </section>
    `)
  })

  test("prints conditional open tag with multiple attributes", () => {
    expectPrintRoundTrip(dedent`
      <% if @admin %>
        <div class="admin-panel" id="admin" data-role="admin">
      <% else %>
        <div class="user-panel" id="user" data-role="user">
      <% end %>
        Dashboard
      </div>
    `)
  })

  test("prints conditional open tag with ERB in attributes", () => {
    expectPrintRoundTrip(dedent`
      <% if @special %>
        <div class="<%= @special_class %>" data-id="<%= @id %>">
      <% else %>
        <div class="<%= @normal_class %>">
      <% end %>
        Content
      </div>
    `)
  })

  test("prints conditional open tag with regular element inside body", () => {
    expectPrintRoundTrip(dedent`
      <% if @condition %>
        <div class="a">
      <% else %>
        <div class="b">
      <% end %>
        <span class="inner">Nested content</span>
      </div>
    `)
  })

  test("prints conditional open tag with complex body", () => {
    expectPrintRoundTrip(dedent`
      <% if @card_style == :fancy %>
        <div class="card fancy">
      <% else %>
        <div class="card simple">
      <% end %>
        <h2><%= @title %></h2>
        <p><%= @description %></p>
        <% if @show_footer %>
          <footer>Footer</footer>
        <% end %>
      </div>
    `)
  })

  test("prints conditional open tag inside ERB block", () => {
    expectPrintRoundTrip(dedent`
      <%= form_with model: @user do |f| %>
        <% if @inline_form %>
          <div class="inline-form">
        <% else %>
          <div class="stacked-form">
        <% end %>
          <%= f.text_field :name %>
        </div>
      <% end %>
    `)
  })

  test("prints conditional open tag with li elements", () => {
    expectPrintRoundTrip(dedent`
      <nav>
        <ul>
          <% if @active == :home %>
            <li class="active">
          <% else %>
            <li>
          <% end %>
            <a href="/">Home</a>
          </li>
        </ul>
      </nav>
    `)
  })

  test("prints conditional open tag with style attribute", () => {
    expectPrintRoundTrip(dedent`
      <% if @highlight %>
        <div style="background: yellow;">
      <% else %>
        <div style="background: white;">
      <% end %>
        Highlighted content
      </div>
    `)
  })

  test("prints multiple sequential conditional open tags", () => {
    expectPrintRoundTrip(dedent`
      <% if @show_header %>
        <header class="full">
      <% else %>
        <header class="minimal">
      <% end %>
        Header content
      </header>
      <% if @show_main %>
        <main class="expanded">
      <% else %>
        <main class="compact">
      <% end %>
        Main content
      </main>
    `)
  })

  test("prints conditional open tag with whitespace variations", () => {
    expectPrintRoundTrip(dedent`
      <% if condition %>
        <div class="a">
      <% else %>
        <div class="b">
      <% end %>
      </div>
    `)
  })

})
