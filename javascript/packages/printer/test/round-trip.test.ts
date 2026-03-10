import { describe, test, beforeAll } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"

import { expectPrintRoundTrip } from "./helpers/printer-test-helpers.js"


describe("Round-trip Parser Accuracy Tests", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("ERB Content Tags", () => {
    expectPrintRoundTrip('<%= @user %>')
    expectPrintRoundTrip('<%= @user.name %>')
    expectPrintRoundTrip('<%= "Hello World" %>')
    expectPrintRoundTrip('<%=   @user   %>')
    expectPrintRoundTrip('<%=@user%>')

    expectPrintRoundTrip('<div><%= @name %></div>')
    expectPrintRoundTrip('Hello <%= @name %>!')
    expectPrintRoundTrip('<%= @first %> <%= @last %>')
  })

  test("ERB Control Flow", () => {
    expectPrintRoundTrip('<% if @user %><% end %>')
    expectPrintRoundTrip('<% if @user %>Hello<% end %>')
    expectPrintRoundTrip('<% if @user %>Hello<% else %>Goodbye<% end %>')

    expectPrintRoundTrip('<% @items.each do |item| %><% end %>')
    expectPrintRoundTrip('<% for i in 1..10 %><% end %>')
    expectPrintRoundTrip('<% while @condition %><% end %>')
    expectPrintRoundTrip('<% unless @condition %><% end %>')
  })

  test("Complex ERB Templates", () => {
    expectPrintRoundTrip(dedent`
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
    `)

    expectPrintRoundTrip(dedent`
      <ul>
        <% @items.each do |item| %>
          <li><%= item.name %> - <%= item.price %></li>
        <% end %>
      </ul>
    `)

    expectPrintRoundTrip(dedent`
      <form>
        <% @fields.each do |field| %>
          <div class="field">
            <label><%= field.label %></label>
            <input type="<%= field.type %>" name="<%= field.name %>" value="<%= field.value %>">
          </div>
        <% end %>
      </form>
    `)
  })

  test("Mixed Content Edge Cases", () => {
    expectPrintRoundTrip('<div><!-- Comment --><%= @content %></div>')
    expectPrintRoundTrip('<script><%= raw @js_code %></script>')
    expectPrintRoundTrip('<style><%= @css_rules %></style>')

    expectPrintRoundTrip('<div data-value="<%= @value %>">Content</div>')

    expectPrintRoundTrip('<div <%= key %>="<%= @value %>">Content</div>')
    expectPrintRoundTrip('<div <%= key %>=     "<%= @value %>">Content</div>')
    expectPrintRoundTrip('<div data-<%= key %>-value="<%= @value %>">Content</div>')
    expectPrintRoundTrip('<div data-<%= key %>-value    =     "<%= @value %>">Content</div>')
    expectPrintRoundTrip('<div <%= key %>-value    =     "<%= @value %>">Content</div>')
    expectPrintRoundTrip('<div <%= key %>    =     "<%= @value %>">Content</div>')

    expectPrintRoundTrip('<%# This is a comment %>')
    expectPrintRoundTrip('<div><%# Hidden comment %><%= @visible %></div>')
  })

  test("Whitespace and ERB", () => {
    expectPrintRoundTrip('<% if true -%>\n  Content\n<% end -%>')
    expectPrintRoundTrip('<%- @content -%>')
    expectPrintRoundTrip('<%= @content -%>\n<%= @more -%>')

    expectPrintRoundTrip(dedent`
      <div>
        <%  if @condition  %>
          Content
        <%  end  %>
      </div>
    `)
  })

  test("Real-world Template Patterns", () => {
    expectPrintRoundTrip(dedent`
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
    `)

    expectPrintRoundTrip(dedent`
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
    `)
  })
})
