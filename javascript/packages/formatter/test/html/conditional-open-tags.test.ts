import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - Conditional Open Tags", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("basic conditional open tags", () => {
    test("formats simple if/else conditional open tag", () => {
      const input = dedent`
        <% if @condition %>
        <div class="a">
        <% else %>
        <div class="b">
        <% end %>
        Content
        </div>
      `

      const expected = dedent`
        <% if @condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          Content
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats unless/else conditional open tag", () => {
      const input = dedent`
        <% unless @minimal %>
        <section class="full">
        <% else %>
        <section class="minimal">
        <% end %>
        <p>Content</p>
        </section>
      `

      const expected = dedent`
        <% unless @minimal %>
          <section class="full">
        <% else %>
          <section class="minimal">
        <% end %>
          <p>Content</p>
        </section>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats if/elsif/else conditional open tag", () => {
      const input = dedent`
        <% if @type == :primary %>
        <button class="btn-primary">
        <% elsif @type == :secondary %>
        <button class="btn-secondary">
        <% else %>
        <button class="btn-default">
        <% end %>
        Click me
        </button>
      `

      const expected = dedent`
        <% if @type == :primary %>
          <button class="btn-primary">
        <% elsif @type == :secondary %>
          <button class="btn-secondary">
        <% else %>
          <button class="btn-default">
        <% end %>
          Click me
        </button>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional open tags with attributes", () => {
    test("formats conditional open tag with multiple attributes", () => {
      const input = dedent`
        <% if @admin %>
        <div class="admin-panel" id="admin" data-role="admin">
        <% else %>
        <div class="user-panel" id="user" data-role="user">
        <% end %>
        Dashboard
        </div>
      `

      const expected = dedent`
        <% if @admin %>
          <div class="admin-panel" id="admin" data-role="admin">
        <% else %>
          <div class="user-panel" id="user" data-role="user">
        <% end %>
          Dashboard
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional open tag with ERB in attributes", () => {
      const input = dedent`
        <% if @special %>
        <div class="<%= @special_class %>" data-id="<%= @id %>">
        <% else %>
        <div class="<%= @normal_class %>">
        <% end %>
        Content
        </div>
      `

      const expected = dedent`
        <% if @special %>
          <div class="<%= @special_class %>" data-id="<%= @id %>">
        <% else %>
          <div class="<%= @normal_class %>">
        <% end %>
          Content
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional open tag with style attribute", () => {
      const input = dedent`
        <% if @highlight %>
        <div style="background: yellow;">
        <% else %>
        <div style="background: white;">
        <% end %>
        Highlighted content
        </div>
      `

      const expected = dedent`
        <% if @highlight %>
          <div style="background: yellow;">
        <% else %>
          <div style="background: white;">
        <% end %>
          Highlighted content
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional open tags with body content", () => {
    test("formats conditional open tag with complex body", () => {
      const input = dedent`
        <% if @card_style == :fancy %>
        <div class="card fancy">
        <% else %>
        <div class="card simple">
        <% end %>
        <h2><%= @title %></h2>
        <p><%= @description %></p>
        </div>
      `

      const expected = dedent`
        <% if @card_style == :fancy %>
          <div class="card fancy">
        <% else %>
          <div class="card simple">
        <% end %>
          <h2><%= @title %></h2>
          <p><%= @description %></p>
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional open tag with nested ERB if in body", () => {
      const input = dedent`
        <% if @card_style == :fancy %>
        <div class="card fancy">
        <% else %>
        <div class="card simple">
        <% end %>
        <h2><%= @title %></h2>
        <% if @show_footer %>
        <footer>Footer</footer>
        <% end %>
        </div>
      `

      const expected = dedent`
        <% if @card_style == :fancy %>
          <div class="card fancy">
        <% else %>
          <div class="card simple">
        <% end %>
          <h2><%= @title %></h2>

          <% if @show_footer %>
            <footer>Footer</footer>
          <% end %>
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("formats conditional open tag with nested complete elements", () => {
      const input = dedent`
        <% if @condition %>
        <div class="a">
        <% else %>
        <div class="b">
        <% end %>
        <span class="inner">Nested content</span>
        </div>
      `

      const expected = dedent`
        <% if @condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          <span class="inner">Nested content</span>
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("multiple sequential conditional open tags", () => {
    test("formats multiple sequential conditional open tags", () => {
      const input = dedent`
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
      `

      const expected = dedent`
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
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional open tags inside blocks", () => {
    test("formats conditional open tag inside ERB block", () => {
      const input = dedent`
        <%= form_with model: @user do |f| %>
        <% if @inline_form %>
        <div class="inline-form">
        <% else %>
        <div class="stacked-form">
        <% end %>
        <%= f.text_field :name %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <%= form_with model: @user do |f| %>
          <% if @inline_form %>
            <div class="inline-form">
          <% else %>
            <div class="stacked-form">
          <% end %>
            <%= f.text_field :name %>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("conditional open tags with li elements", () => {
    test("formats conditional open tag with li elements", () => {
      const input = dedent`
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
      `

      const expected = dedent`
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
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })

  describe("preserves already well-formatted conditional open tags", () => {
    test("preserves well-formatted conditional open tag", () => {
      const input = dedent`
        <% if @condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          Content
        </div>
      `

      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })
})
