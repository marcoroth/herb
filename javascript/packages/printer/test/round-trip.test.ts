import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../src/index.js"

describe("Round-trip Parser Accuracy Tests", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function roundTripTest(input: string, description: string) {
    test(description, () => {
      const parseResult = Herb.parse(input)
      expect(parseResult.value).toBeTruthy()

      const printer = new IdentityPrinter()
      const output = printer.print(parseResult.value!)

      expect(output).toBe(input)
    })
  }

  describe("ERB Content Tags", () => {
    roundTripTest('<%= @user %>', 'simple ERB content tag')
    roundTripTest('<%= @user.name %>', 'ERB content with method call')
    roundTripTest('<%= "Hello World" %>', 'ERB content with string literal')
    roundTripTest('<%=   @user   %>', 'ERB content with extra spaces')
    roundTripTest('<%=@user%>', 'ERB content without spaces')

    roundTripTest('<div><%= @name %></div>', 'ERB content inside HTML')
    roundTripTest('Hello <%= @name %>!', 'ERB content mixed with text')
    roundTripTest('<%= @first %> <%= @last %>', 'multiple ERB content tags')
  })

  describe("ERB Control Flow", () => {
    roundTripTest('<% if @user %><% end %>', 'simple if statement')
    roundTripTest('<% if @user %>Hello<% end %>', 'if with content')
    roundTripTest('<% if @user %>Hello<% else %>Goodbye<% end %>', 'if-else statement')

    roundTripTest('<% @items.each do |item| %><% end %>', 'each loop')
    roundTripTest('<% for i in 1..10 %><% end %>', 'for loop')
    roundTripTest('<% while @condition %><% end %>', 'while loop')
    roundTripTest('<% unless @condition %><% end %>', 'unless statement')
  })

  describe("Complex ERB Templates", () => {
    const complexTemplate = dedent`
      <div>
        <% if @user %>
          <h1>Hello <%= @user.name %>!</h1>
          <% if @user.admin? %>
            <p>You are an admin</p>
          <% end %>
        <% else %>
          <p>Please log in</p>
        <% end %>
      </div>
    `
    roundTripTest(complexTemplate, 'nested ERB control flow with HTML')

    const listTemplate = dedent`
      <ul>
        <% @items.each do |item| %>
          <li><%= item.name %> - <%= item.price %></li>
        <% end %>
      </ul>
    `
    roundTripTest(listTemplate, 'ERB loop with HTML list')

    const formTemplate = dedent`
      <form>
        <% @fields.each do |field| %>
          <div class="field">
            <label><%= field.label %></label>
            <input type="<%= field.type %>" name="<%= field.name %>" value="<%= field.value %>">
          </div>
        <% end %>
      </form>
    `
    roundTripTest(formTemplate, 'ERB in form with dynamic attributes')
  })

  describe("Mixed Content Edge Cases", () => {
    roundTripTest('<div><!-- Comment --><%= @content %></div>', 'ERB with HTML comments')
    roundTripTest('<script><%= raw @js_code %></script>', 'ERB in script tag')
    roundTripTest('<style><%= @css_rules %></style>', 'ERB in style tag')

    roundTripTest('<div data-value="<%= @value %>">Content</div>', 'ERB in attribute value')
    // Note: ERB in tag names is not yet fully supported by the parser
    // roundTripTest('<%= @tag %> class="<%= @class %>">Content</<%= @tag %>>', 'ERB in tag names')

    roundTripTest('<%# This is a comment %>', 'ERB comment tag')
    roundTripTest('<div><%# Hidden comment %><%= @visible %></div>', 'ERB comment mixed with content')
  })

  describe("Whitespace and ERB", () => {
    roundTripTest('<% if true -%>\n  Content\n<% end -%>', 'ERB with whitespace control')
    roundTripTest('<%- @content -%>', 'ERB with strip whitespace')
    roundTripTest('<%= @content -%>\n<%= @more -%>', 'multiple ERB with whitespace control')

    roundTripTest(dedent`
      <div>
        <%  if @condition  %>
          Content
        <%  end  %>
      </div>
    `, 'ERB with extra spaces in tags')
  })

  describe("Real-world Template Patterns", () => {
    const layoutTemplate = dedent`
      <!DOCTYPE html>
      <html>
      <head>
        <title><%= @title %></title>
        <%= csrf_meta_tags %>
      </head>
      <body>
        <header>
          <% if user_signed_in? %>
            Welcome <%= current_user.name %>!
          <% else %>
            <%= link_to "Sign In", new_user_session_path %>
          <% end %>
        </header>

        <main>
          <%= yield %></main>
      </body>
      </html>
    `
    roundTripTest(layoutTemplate, 'typical Rails layout template')

    const partialTemplate = dedent`
      <div class="card">
        <h3><%= item.title %></h3>
        <p><%= truncate(item.description, length: 100) %></p>

        <% if item.image.present? %>
          <%= image_tag item.image, alt: item.title %>
        <% end %>

        <div class="actions">
          <%= link_to "View", item_path(item), class: "btn btn-primary" %>
          <% if can? :edit, item %>
            <%= link_to "Edit", edit_item_path(item), class: "btn btn-secondary" %>
          <% end %>
        </div>
      </div>
    `
    roundTripTest(partialTemplate, 'typical Rails partial template')
  })
})
