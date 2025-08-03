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

      <main>
        <p>Main content</p>
      </main>
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

  test("adds newlines between top-level elements when none exist", () => {
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
            <h1>Welcome <%= user_data[:name] %></h1>
            <p>Age: <%= user_data[:age] %></p>
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

  test("adds newlines between adjacent ERB and HTML with no spacing", () => {
    const source = `<% user = current_user %><div>Hello</div><% if user %><span>Welcome</span><% end %>`
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% user = current_user %>

      <div>Hello</div>

      <% if user %>
        <span>Welcome</span>
      <% end %>
    `)
  })

  test("handles single line with multiple elements", () => {
    const source = `<h1>Title</h1><p>Content</p><footer>Footer</footer>`
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>Title</h1>

      <p>Content</p>

      <footer>Footer</footer>
    `)
  })

  test("splits mixed content with nested block elements properly", () => {
    const source = dedent`
      <div>hello <div>complex <span>nested</span> content</div> world</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </div>
    `)
  })

  test("handles mixed content in paragraph with block elements", () => {
    const source = dedent`
      <p>hello <div>complex <span>nested</span> content</div> world</p>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </p>
    `)
  })

  test("formats nested paragraph in div with mixed content", () => {
    const source = dedent`
      <div>hello <p>complex <span>nested</span> content</p> world</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        hello
        <p>complex <span>nested</span> content</p>
        world
      </div>
    `)
  })

  test("preserves inline elements while splitting long mixed content", () => {
    const source = dedent`
      <p>hello <b>complex <span>nested</span> content</b> world</p>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        hello <b>complex <span>nested</span> content</b> world
      </p>
    `)
  })

  test("formats HTML elements with ERB conditionals inline when total attributes <= 3", () => {
    const source = dedent`
      <span <% if true %> class="one" <% end %> another="attribute" final="one">Content</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span <% if true %> class="one" <% end %> another="attribute" final="one">
        Content
      </span>
    `)
  })

  test("formats regular HTML elements in multiline when attributes > 3", () => {
    const source = dedent`
      <div id="element" class="bg-gray-300" another="attribute" final="one">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
        Content
      </div>
    `)
  })

  test("formats HTML elements with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <div <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
        Content
      </div>
    `)
  })

  test("formats self-closing tags with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one" />
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      />
    `)
  })

  test("keeps self-closing tags with ERB conditionals inline when total attributes <= 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" />
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input <% if disabled? %> disabled <% end %> id="element" />
    `)
  })

  test("formats void elements with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one">
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
    `)
  })

  test("keeps void elements with ERB conditionals inline when total attributes <= 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element">
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input <% if disabled? %> disabled <% end %> id="element">
    `)
  })

  test("handles multiple ERB conditionals with attributes correctly", () => {
    const source = dedent`
      <div <% if disabled? %> disabled <% end %> <% if hidden? %> hidden <% end %> id="element" class="test">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        <% if disabled? %>
          disabled
        <% end %>
        <% if hidden? %>
          hidden
        <% end %>
        id="element"
        class="test"
      >
        Content
      </div>
    `)
  })

  test("keeps simple ERB conditionals with few attributes inline", () => {
    const source = dedent`
      <span <% if active? %> class="active" <% end %>>Text</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span <% if active? %> class="active" <% end %>>
        Text
      </span>
    `)
  })

  test("preserves inline opening tag for block elements with few attributes", () => {
    const source = dedent`
      <div class="flex flex-col">
        <h3 class="line-clamp-1">
          <pre>Content</pre>
        </h3>
      </div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(source)
  })
})
