import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - Conditional HTML Elements", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("basic conditional elements", () => {
    test("formats simple conditional element with if", () => {
      const input = dedent`
        <% if @with_icon %>
        <div class="icon">
        <% end %>
        <span>Hello</span>
        <% if @with_icon %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% if @with_icon %>
          <div class="icon">
        <% end %>

          <span>Hello</span>

        <% if @with_icon %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional element with unless", () => {
      const input = dedent`
        <% unless @hide_wrapper %>
        <section>
        <% end %>
        <p>Content</p>
        <% unless @hide_wrapper %>
        </section>
        <% end %>
      `

      const expected = dedent`
        <% unless @hide_wrapper %>
          <section>
        <% end %>

          <p>Content</p>

        <% unless @hide_wrapper %>
          </section>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional elements with attributes", () => {
    test("formats conditional element with attributes", () => {
      const input = dedent`
        <% if @show_container %>
        <div class="container" id="main" data-value="test">
        <% end %>
        <span>Inside</span>
        <% if @show_container %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% if @show_container %>
          <div class="container" id="main" data-value="test">
        <% end %>

          <span>Inside</span>

        <% if @show_container %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional elements with body content", () => {
    test("formats conditional element with multiple body elements", () => {
      const input = dedent`
        <% if @with_wrapper %>
        <section class="wrapper">
        <% end %>
        <h1>Title</h1>
        <p>Description</p>
        <% if @with_wrapper %>
        </section>
        <% end %>
      `

      const expected = dedent`
        <% if @with_wrapper %>
          <section class="wrapper">
        <% end %>

          <h1>Title</h1>
          <p>Description</p>

        <% if @with_wrapper %>
          </section>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional element with ERB content in body", () => {
      const input = dedent`
        <% if @show_card %>
        <div class="card">
        <% end %>
        <h2><%= @title %></h2>
        <p><%= @description %></p>
        <% if @show_card %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% if @show_card %>
          <div class="card">
        <% end %>

          <h2><%= @title %></h2>
          <p><%= @description %></p>

        <% if @show_card %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("nested conditional elements", () => {
    test("formats nested conditional elements", () => {
      const input = dedent`
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
      `

      const expected = dedent`
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
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional element with nested ERB if", () => {
      const input = dedent`
        <% if @with_wrapper %>
        <section>
        <% end %>
        <% if true %>
        <span>Conditional inside</span>
        <% end %>
        <% if @with_wrapper %>
        </section>
        <% end %>
      `

      const expected = dedent`
        <% if @with_wrapper %>
          <section>
        <% end %>

          <% if true %>
            <span>Conditional inside</span>
          <% end %>

        <% if @with_wrapper %>
          </section>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("multiple sequential conditional elements", () => {
    test("formats multiple sequential conditional elements", () => {
      const input = dedent`
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
      `

      const expected = dedent`
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
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional elements with void elements", () => {
    test("formats conditional element with void element siblings", () => {
      const input = dedent`
        <% if @with_container %>
        <div>
        <% end %>
        <br>
        <hr>
        <% if @with_container %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% if @with_container %>
          <div>
        <% end %>

          <br>
          <hr>

        <% if @with_container %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional elements inside blocks", () => {
    test("formats conditional element inside block", () => {
      const input = dedent`
        <%= form_with do %>
        <% if @show_wrapper %>
        <div class="form-wrapper">
        <% end %>
        <input type="text">
        <% if @show_wrapper %>
        </div>
        <% end %>
        <% end %>
      `

      const expected = dedent`
        <%= form_with do %>
          <% if @show_wrapper %>
            <div class="form-wrapper">
          <% end %>

            <input type="text">

          <% if @show_wrapper %>
            </div>
          <% end %>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("preserves original formatting when appropriate", () => {
    test("preserves already well-formatted conditional element", () => {
      const input = dedent`
        <% if @with_icon %>
          <div class="icon">
        <% end %>

          <span>Hello</span>

        <% if @with_icon %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })
})
