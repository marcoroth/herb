import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"

let formatter: Formatter

describe("ERB Formatter Fixture Tests", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
  })

  describe("Attributes fixtures", () => {
    test("attributes.html.erb - handles complex multiline attributes", () => {
      const source = dedent`
        <img src="image.jpg" alt="Responsive Image"
             srcset="image-480w.jpg 480w,
                     image-800w.jpg 800w,
                     image-1200w.jpg 1200w"
             sizes="(max-width: 600px) 480px,
                    (max-width: 1000px) 800px,
                    1200px"
             data-autocomplete-min-length-value="2"
             data-short-url="//test.com/?q=v"
             data-long-url="https://google.ca/this-is-a-long-url-with-a-query-string?query=something"
             data-long-url-single='https://google.ca/this-is-a-long-url-with-a-query-string?query=something'>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          src="image.jpg"
          alt="Responsive Image"
          srcset="image-480w.jpg 480w, image-800w.jpg 800w, image-1200w.jpg 1200w"
          sizes="(max-width: 600px) 480px, (max-width: 1000px) 800px, 1200px"
          data-autocomplete-min-length-value="2"
          data-short-url="//test.com/?q=v"
          data-long-url="https://google.ca/this-is-a-long-url-with-a-query-string?query=something"
          data-long-url-single="https://google.ca/this-is-a-long-url-with-a-query-string?query=something"
        >
      `)
    })

    test("multiline_attributes.html.erb - handles attributes with ERB", () => {
      const source = dedent`
        <button class="text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
        disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed
        aria-disabled:text-gray-300 aria-disabled:bg-transparent aria-disabled:border-gray-300 aria-disabled:cursor-not-allowed">Button</button>

        <nav class="
        flex flex-col bg-gray-15 p-4 w-full       " data-controller="<%= stimulus_id %>" data-<%= stimulus_id %>-cookie-value="solidus_admin"> Foooo </nav>

        <p
        single-double-quotes='"double" quotes'
        double-single-quotes="'single' quotes"
        escaped-quotes=escaped&quote;quotes
        ></p>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <button class="text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
        disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed
        aria-disabled:text-gray-300 aria-disabled:bg-transparent aria-disabled:border-gray-300 aria-disabled:cursor-not-allowed">Button</button>

        <nav class="
        flex flex-col bg-gray-15 p-4 w-full       " data-controller="<%= stimulus_id %>" data-<%= stimulus_id %>-cookie-value="solidus_admin"> Foooo </nav>

        <p
        single-double-quotes='"double" quotes'
        double-single-quotes="'single' quotes"
        escaped-quotes=escaped&quote;quotes
        ></p>
      `)
    })
  })

  describe("Case statement fixtures", () => {
    test("case_when.html.erb - formats case/when statements", () => {
      const source = dedent`
        <% case 'fake' %>
                <% when 'fake' %>
          <span>there</span>
                  <% when 'something' %>
          <span>there</span>
        <% when 'else' %>
                 <span>hi</span>
                <% else %>
          <span>there</span>
            <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% case 'fake' %>
        <% when 'fake' %>
          <span>there</span>
        <% when 'something' %>
          <span>there</span>
        <% when 'else' %>
          <span>hi</span>
        <% else %>
          <span>there</span>
        <% end %>
      `)
    })

    test("case_in.html.erb - handles case/in patterns", () => {
      const source = dedent`
        <% case value %>
        <% in String %>
          <p>It's a string</p>
        <% in Integer %>
          <p>It's an integer</p>
        <% else %>
          <p>Something else</p>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% case value %>
        <% in String %>
          <p>It's a string</p>
        <% in Integer %>
          <p>It's an integer</p>
        <% else %>
          <p>Something else</p>
        <% end %>
      `)
    })

    test("complex_case_when.html.erb - handles complex case statements", () => {
      const source = dedent`
        <% case user.role %>
        <% when 'admin', 'moderator' %>
          <div class="admin-panel">
            <h2>Admin Controls</h2>
            <% if user.permissions.include?('delete') %>
              <button class="btn-danger">Delete</button>
            <% end %>
          </div>
        <% when 'user' %>
          <div class="user-panel">
            <p>Welcome, <%= user.name %>!</p>
          </div>
        <% else %>
          <div class="guest-panel">
            <p>Please log in</p>
          </div>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% case user.role %>
        <% when 'admin', 'moderator' %>
          <div class="admin-panel">
            <h2>Admin Controls</h2>

            <% if user.permissions.include?('delete') %>
              <button class="btn-danger">Delete</button>
            <% end %>
          </div>
        <% when 'user' %>
          <div class="user-panel">
            <p>Welcome, <%= user.name %>!</p>
          </div>
        <% else %>
          <div class="guest-panel">
            <p>Please log in</p>
          </div>
        <% end %>
      `)
    })
  })

  describe("Comment fixtures", () => {
    test("comments.html.erb - handles various comment formats", () => {
      const source = dedent`
        <%#
        This fails
          hey
            hey
              hey
          hey
        %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <%#
          This fails
          hey
            hey
              hey
          hey
        %>
      `)
    })

    test("comments.html.erb - handles various comment formats", () => {
      const source = dedent`
        <%#
            This fails
            hey
              hey
                hey
            hey
        %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <%#
          This fails
          hey
            hey
              hey
          hey
        %>
      `)
    })

    test("comments.html.erb - handles various comment formats", () => {
      const source = dedent`
        <%# This fails
          This fails
          hey
            hey
              hey
          hey
        %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <%#
          This fails
          This fails
          hey
            hey
              hey
          hey
        %>
      `)
    })

    test("comments-2.html.erb - handles inline comments", () => {
      const source = dedent`
        <div>
          <%# Inline comment %>
          <p>Content</p>
          <% # Another comment style %>
          <span>More content</span>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <%# Inline comment %>
          <p>Content</p>

          <% # Another comment style %>
          <span>More content</span>
        </div>
      `)
    })
  })

  describe("Block fixtures", () => {
    test("with_block.html.erb - formats blocks correctly", () => {
      const source = "<%foo.each do |bar|%> <p><%=baz%></p> <%end%>"

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% foo.each do |bar| %>
          <p><%= baz %></p>
        <% end %>
      `)
    })
  })

  describe("Conditional fixtures", () => {
    test("if_then_else.html.erb - handles if/then/else statements", () => {
      const source = dedent`
        <% if eeee then "b" else c end %>
        <% if eeee then a else c end %>

        <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>

        <div <% if eeee then "b" else c end %>></div>
        <div <% if eeee then a else c end %>></div>

        <div <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>></div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% if eeee then "b" else c end %>
        <% if eeee then a else c end %>

        <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>

        <div <% if eeee then "b" else c end %>></div>
        <div <% if eeee then a else c end %>></div>

        <div
          <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>
        ></div>
      `)
    })
  })

  describe("Text and formatting fixtures", () => {
    test("empty-text-between-erb.html.erb - handles empty text nodes", () => {
      const source = dedent`
        <% if condition %>

        <div>Content</div>

        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% if condition %>
          <div>Content</div>
        <% end %>
      `)
    })

    test("formatted.html.erb - preserves formatting", () => {
      const source = dedent`
        <div class="container">
          <h1>Welcome</h1>
          <% if user.present? %>
            <p>Hello <%= user.name %>!</p>
          <% else %>
            <p>Please log in</p>
          <% end %>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="container">
          <h1>Welcome</h1>

          <% if user.present? %>
            <p>Hello <%= user.name %>!</p>
          <% else %>
            <p>Please log in</p>
          <% end %>
        </div>
      `)
    })

    test("formatted-2.html.erb - handles complex formatting", () => {
      const source = dedent`
        <!DOCTYPE html>
        <html>
          <head>
            <title><%= page_title %></title>
          </head>
          <body>
            <% content_for :navigation do %>
              <nav class="main-nav">
                <ul>
                  <% nav_items.each do |item| %>
                    <li><%= link_to item.name, item.path %></li>
                  <% end %>
                </ul>
              </nav>
            <% end %>

            <main>
              <%= yield %>
            </main>
          </body>
        </html>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <!DOCTYPE html>

        <html>
          <head>
            <title><%= page_title %></title>
          </head>

          <body>
            <% content_for :navigation do %>
              <nav class="main-nav">
                <ul>
                  <% nav_items.each do |item| %>
                    <li><%= link_to item.name, item.path %></li>
                  <% end %>
                </ul>
              </nav>
            <% end %>

            <main><%= yield %></main>
          </body>
        </html>
      `)
    })
  })

  describe("Deep nesting fixtures", () => {
    test("long_deep_nested.html.erb - handles deep nesting", () => {
      const source = dedent`
        <div>
        <div>
        <div>
        <div>
        <div>
          <% link_to "Very long long long long long long long long string here and there", very_very_very_long_long_long_pathhhhhh_here, opt: "212", options: "222sdasdasd", class: "  322 ", dis: diss%>

          <% link_to "string", path, opt: "212", options: "222sdasdasd"%>

          <div>
            <%= react_component({ greeting: 'react-rails.' }) %>
          </div>
        </div>
        </div>
        </div>
        </div>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <div>
            <div>
              <div>
                <div>
                  <% link_to "Very long long long long long long long long string here and there", very_very_very_long_long_long_pathhhhhh_here, opt: "212", options: "222sdasdasd", class: "  322 ", dis: diss %>

                  <% link_to "string", path, opt: "212", options: "222sdasdasd" %>

                  <div><%= react_component({ greeting: 'react-rails.' }) %></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `)
    })

    test("long_deep_nested-2.html.erb - handles another deep nesting case", () => {
      const source = dedent`
        <div class="outer">
          <div class="level-1">
            <div class="level-2">
              <div class="level-3">
                <div class="level-4">
                  <div class="level-5">
                    <span>Deep content</span>
                    <% items.each_with_index do |item, index| %>
                      <div class="item-<%= index %>"><%= item.title %></div>
                    <% end %>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="outer">
          <div class="level-1">
            <div class="level-2">
              <div class="level-3">
                <div class="level-4">
                  <div class="level-5">
                    <span>Deep content</span>

                    <% items.each_with_index do |item, index| %>
                      <div class="item-<%= index %>"><%= item.title %></div>
                    <% end %>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `)
    })
  })

  describe("Special content fixtures", () => {
    test("utf8.html.erb - handles UTF-8 characters", () => {
      const source = dedent`
        <div>
          <h1>Тест UTF-8 🚀</h1>
          <p>Café, naïve, résumé</p>
          <span>中文测试</span>
          <div>🍰🎉🎊✨🌟💫⭐🔥💥🎯</div>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <h1>Тест UTF-8 🚀</h1>
          <p>Café, naïve, résumé</p>
          <span>中文测试</span>
          <div>🍰🎉🎊✨🌟💫⭐🔥💥🎯</div>
        </div>
      `)
    })

    test("yield.html.erb - handles yield statements", () => {
      const source = dedent`
        <div class="layout">
          <header>
            <%= yield :header %>
          </header>

          <main>
            <%= yield %>
          </main>

          <aside>
            <%= yield :sidebar if content_for?(:sidebar) %>
          </aside>

          <footer>
            <%= yield :footer %>
          </footer>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="layout">
          <header><%= yield :header %></header>

          <main><%= yield %></main>

          <aside><%= yield :sidebar if content_for?(:sidebar) %></aside>

          <footer><%= yield :footer %></footer>
        </div>
      `)
    })

    test("multiple erb expressions in block element preserve newlines (GH-1210)", () => {
      const source = dedent`
        <main>
          <%= render "shared/flash" %>
          <%= yield %>
        </main>
      `

      const result = formatter.format(source)

      expect(result).toBe(source)
    })

    test("multiple erb expressions with text between them in block element stay inline", () => {
      const source = dedent`
        <main><%= render "shared/flash" %> <%= yield %></main>
      `

      const result = formatter.format(source)

      expect(result).toBe(source)
    })

    test("front-matter.html.erb - handles front matter", () => {
      const source = dedent`
        ---
        title: "My Page"
        layout: "application"
        ---

        <div class="page">
          <h1><%= @title || "Default Title" %></h1>
          <p>Page content here</p>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        ---
        title: "My Page"
        layout: "application"
        ---

        <div class="page">
          <h1><%= @title || "Default Title" %></h1>
          <p>Page content here</p>
        </div>
      `)
    })

    test("trailing_comma.html.erb - handles trailing commas", () => {
      const source = dedent`
        <%= link_to "Home",
            root_path,
            class: "nav-link",
            data: {
              toggle: "tooltip",
              placement: "top",
            } %>

        <%= form_with model: @user,
            local: true,
            html: {
              class: "user-form",
              data: { remote: true, },
            } do |f| %>
          <%= f.text_field :name %>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <%= link_to "Home",
            root_path,
            class: "nav-link",
            data: {
              toggle: "tooltip",
              placement: "top",
            } %>

        <%= form_with model: @user,
            local: true,
            html: {
              class: "user-form",
              data: { remote: true, },
            } do |f| %>
          <%= f.text_field :name %>
        <% end %>
      `)
    })
  })

  describe("Simple fixtures", () => {
    test("single.html.erb - handles single elements", () => {
      const source = "<div>Simple content</div>"

      const result = formatter.format(source)

      expect(result).toBe(`<div>Simple content</div>`)
    })

    test("single-2.html.erb - handles another single element case", () => {
      const source = "<span class='highlight'>Important text</span>"

      const result = formatter.format(source)

      expect(result).toBe(`<span class="highlight">Important text</span>`)
    })
  })

  describe("Tailwind CSS fixtures", () => {
    test("tailwindcss/class_sorting.html.erb - handles Tailwind classes", () => {
      const source = dedent`
        <div class="bg-red-500 text-white p-4 rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50">
          <h2 class="text-xl font-bold mb-2">Card Title</h2>
          <p class="text-sm opacity-75">Card description</p>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          class="
            bg-red-500 text-white p-4 rounded-lg shadow-md hover:bg-red-600
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50
          "
        >
          <h2 class="text-xl font-bold mb-2">Card Title</h2>
          <p class="text-sm opacity-75">Card description</p>
        </div>
      `)
    })
  })
})
