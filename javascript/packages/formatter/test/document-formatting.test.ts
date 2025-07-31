import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

import dedent from "dedent"

let formatter: Formatter

describe("Document-level formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves newline between ERB assignment and HTML element", () => {
    const source = dedent`
      <% array = ["One", "Two", "Three"] %>

      <ul>
        <% array.each do |item| %>
          <li><%= item %></li>
        <% end %>
      </ul>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% array = ["One", "Two", "Three"] %>

      <ul>
        <% array.each do |item| %>
          <li><%= item %></li>
        <% end %>
      </ul>
    `)
  })

  test("preserves newline between multiple ERB blocks", () => {
    const source = dedent`
      <% title = "Hello World" %>

      <% content = "Some content" %>

      <div><%= title %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% title = "Hello World" %>

      <% content = "Some content" %>

      <div><%= title %></div>
    `)
  })

  test("preserves newline between HTML elements", () => {
    const source = dedent`
      <div>First section</div>

      <div>Second section</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>First section</div>

      <div>Second section</div>
    `)
  })

  test("preserves newline between ERB block and HTML", () => {
    const source = dedent`
      <% if user.present? %>
        <span>Welcome <%= user.name %></span>
      <% end %>

      <main>
        <p>Main content</p>
      </main>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% if user.present? %>
        <span>Welcome <%= user.name %></span>
      <% end %>

      <main><p>Main content</p></main>
    `)
  })

  test("preserves multiple blank lines as single blank line", () => {
    const source = dedent`
      <% variable = "test" %>



      <div>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% variable = "test" %>

      <div>Content</div>
    `)
  })

  test("does not add extra newlines when no blank lines exist", () => {
    const source = dedent`
      <% title = "Test" %>
      <div><%= title %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% title = "Test" %>
      <div><%= title %></div>
    `)
  })

  test("handles complex document with mixed ERB and HTML", () => {
    const source = dedent`
      <% page_title = "User Profile" %>
      <% user_data = { name: "John", age: 30 } %>

      <!DOCTYPE html>
      <html>
        <head>
          <title><%= page_title %></title>
        </head>

        <body>
          <% if user_data %>
            <h1>Welcome <%= user_data[:name] %></h1>
            <p>Age: <%= user_data[:age] %></p>
          <% end %>

          <footer>
            <p>&copy; 2024</p>
          </footer>
        </body>
      </html>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% page_title = "User Profile" %>
      <% user_data = { name: "John", age: 30 } %>

      <!DOCTYPE html>
      <html>
        <head>
          <title>
            <%= page_title %>
          </title>
        </head>
        <body>
          <% if user_data %>
            <h1>
              Welcome
              <%= user_data[:name] %>
            </h1>
            <p>
              Age:
              <%= user_data[:age] %>
            </p>
          <% end %>
          <footer>
            <p>&copy; 2024</p>
          </footer>
        </body>
      </html>
    `)
  })

  test("preserves newlines around comments", () => {
    const source = dedent`
      <% # This is a comment %>

      <div>Content</div>

      <%# Another comment %>

      <p>More content</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% # This is a comment %>

      <div>Content</div>

      <%# Another comment %>

      <p>More content</p>
    `)
  })

  test("handles ERB loops with proper spacing", () => {
    const source = dedent`
      <% items = [1, 2, 3] %>

      <% items.each do |item| %>
        <div class="item">
          <span><%= item %></span>
        </div>
      <% end %>

      <div class="footer">Done</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% items = [1, 2, 3] %>

      <% items.each do |item| %>
        <div class="item">
          <span><%= item %></span>
        </div>
      <% end %>

      <div class="footer">
        Done
      </div>
    `)
  })
})
