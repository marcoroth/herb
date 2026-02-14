import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { expectPrintRoundTrip } from "../helpers/printer-test-helpers.js"

describe("HTMLConditionalElementNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints simple conditional element with if", () => {
    expectPrintRoundTrip(dedent`
      <% if @with_icon %>
        <div class="icon">
      <% end %>
        <span>Hello</span>
      <% if @with_icon %>
        </div>
      <% end %>
    `)
  })

  test("prints conditional element with unless", () => {
    expectPrintRoundTrip(dedent`
      <% unless @hide_wrapper %>
        <section>
      <% end %>
        <p>Content</p>
      <% unless @hide_wrapper %>
        </section>
      <% end %>
    `)
  })

  test("prints conditional element with attributes", () => {
    expectPrintRoundTrip(dedent`
      <% if @show_container %>
        <div class="container" id="main" data-value="test">
      <% end %>
        <span>Inside</span>
      <% if @show_container %>
        </div>
      <% end %>
    `)
  })

  test("prints conditional element with body content", () => {
    expectPrintRoundTrip(dedent`
      <% if @with_wrapper %>
        <section class="wrapper">
      <% end %>
        <h1>Title</h1>
        <p>Description</p>
      <% if @with_wrapper %>
        </section>
      <% end %>
    `)
  })

  test("prints nested conditional elements", () => {
    expectPrintRoundTrip(dedent`
      <% if @outer %>
        <div class="outer">
      <% end %>
        <% if @inner %>
          <span class="inner">
        <% end %>
          Content
        <% if @inner %>
          </span>
        <% end %>
      <% if @outer %>
        </div>
      <% end %>
    `)
  })

  test("prints conditional element with nested ERB if", () => {
    expectPrintRoundTrip(dedent`
      <% if @with_wrapper %>
        <section>
      <% end %>
        <% if true %>
          <span>Conditional inside</span>
        <% end %>
      <% if @with_wrapper %>
        </section>
      <% end %>
    `)
  })

  test("prints conditional element with ERB content in body", () => {
    expectPrintRoundTrip(dedent`
      <% if @show_card %>
        <div class="card">
      <% end %>
        <h2><%= @title %></h2>
        <p><%= @description %></p>
      <% if @show_card %>
        </div>
      <% end %>
    `)
  })

  test("prints multiple sequential conditional elements", () => {
    expectPrintRoundTrip(dedent`
      <% if @show_header %>
        <header>
      <% end %>
        <h1>Header</h1>
      <% if @show_header %>
        </header>
      <% end %>
      <% if @show_footer %>
        <footer>
      <% end %>
        <p>Footer</p>
      <% if @show_footer %>
        </footer>
      <% end %>
    `)
  })

  test("prints conditional element with void element sibling", () => {
    expectPrintRoundTrip(dedent`
      <% if @with_container %>
        <div>
      <% end %>
        <br>
        <hr>
      <% if @with_container %>
        </div>
      <% end %>
    `)
  })

  test("prints conditional element inside block", () => {
    expectPrintRoundTrip(dedent`
      <%= form_with do %>
        <% if @show_wrapper %>
          <div class="form-wrapper">
        <% end %>
          <input type="text">
        <% if @show_wrapper %>
          </div>
        <% end %>
      <% end %>
    `)
  })
})
