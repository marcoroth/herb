import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"

let formatter: Formatter

describe("ERB Formatter Compatibility Tests", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
  })

  describe("Attributes handling", () => {
    test("formats multiline attributes correctly", () => {
      const source = dedent`
        <img src="image.jpg" alt="Responsive Image"
             srcset="image-480w.jpg 480w,
                     image-800w.jpg 800w,
                     image-1200w.jpg 1200w"
             sizes="(max-width: 600px) 480px,
                    (max-width: 1000px) 800px,
                    1200px"
             data-autocomplete-min-length-value=2
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

    test("handles complex multiline attributes with ERB", () => {
      const source = dedent`
        <button class="text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
        disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed
        aria-disabled:text-gray-300 aria-disabled:bg-transparent aria-disabled:border-gray-300 aria-disabled:cursor-not-allowed">Button</button>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <button
          class="
            text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
            disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed
            aria-disabled:text-gray-300 aria-disabled:bg-transparent aria-disabled:border-gray-300 aria-disabled:cursor-not-allowed
          "
        >
          Button
        </button>
      `)
    })

    test("handles ERB in attributes", () => {
      const source = dedent`
        <nav class="
        flex flex-col bg-gray-15 p-4 w-full       " data-controller="<%= stimulus_id %> " data-<%= stimulus_id %>-cookie-value="solidus_admin"> Foooo </nav>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <nav
          class="flex flex-col bg-gray-15 p-4 w-full"
          data-controller="<%= stimulus_id %> "
          data-<%= stimulus_id %>-cookie-value="solidus_admin"
        >
          Foooo
        </nav>
      `)
    })

    test.skip("handles mixed quote types in attributes", () => {
      const source = dedent`
        <p
        single-double-quotes='"double" quotes'
        double-single-quotes="'single' quotes"
        escaped-quotes=escaped&quote;quotes
        ></p>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p
          single-double-quotes='"double" quotes'
          double-single-quotes="'single' quotes"
          escaped-quotes="escaped&quote;quotes"
        ></p>
      `)
    })
  })

  describe("ERB control structures", () => {
    test("formats simple if-then-else expressions", () => {
      const source = dedent`
        <% if eeee then "b" else c end %>
        <% if eeee then a else c end %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% if eeee then "b" else c end %>
        <% if eeee then a else c end %>
      `)
    })

    test("formats long if-then-else to multiline", () => {
      const source = dedent`
        <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>
      `)
    })

    test("handles ERB in tag attributes", () => {
      const source = dedent`
        <div <% if eeee then "b" else c end %>></div>
        <div <% if eeee then a else c end %>></div>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div <% if eeee then "b" else c end %>></div>
        <div <% if eeee then a else c end %>></div>
      `)
    })

    test("handles long ERB in tag attributes", () => {
      const source = dedent`
        <div <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>></div>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div
          <% if longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong then a else c end %>
        ></div>
      `)
    })
  })

  describe("Basic formatting", () => {
    test("formats simple tags", () => {
      const source = "<div        > asdf    </div>"
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div>asdf</div>
      `)
    })

    test("handles custom tag names with dashes", () => {
      const source = "<custom-div        > asdf    </custom-div>"
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <custom-div>asdf</custom-div>
      `)
    })

    test("formats empty text between ERB tags", () => {
      const source = dedent`
        <% if true %>
        <div>content</div>

        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% if true %>
          <div>content</div>
        <% end %>
      `)
    })
  })

  describe("Complex formatting cases", () => {
    test("handles long text content", () => {
      const source = dedent`
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et
        dolore magna aliqua. 🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
        ut aliquip ex ea commodo <span>co<strong>nse</strong>quat.</span> Duis aute irure dolor in reprehenderit in
        voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt
        in culpa qui officia deserunt mollit anim id est laborum.</p>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. 🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰Ut
          enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo <span>co<strong>nse</strong>quat.</span> Duis aute
          irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa
          qui officia deserunt mollit anim id est laborum.
        </p>
      `)
    })

    test("formats complex ERB render calls", () => {
      const source =
        "<div> <%=render MyComponent.new(foo:barbarbarbarbarbarbarbar,bar:bazbazbazbazbazbazbazbaz)%> </div>"

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div>
          <%= render MyComponent.new(foo:barbarbarbarbarbarbarbar,bar:bazbazbazbazbazbazbazbaz) %>
        </div>
      `)
    })
  })

  describe("UTF-8 handling", () => {
    test("properly handles UTF-8 characters", () => {
      const source = dedent`
        <div>🍰 UTF-8 content with émojis and special characters ñ</div>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div>🍰 UTF-8 content with émojis and special characters ñ</div>
      `)
    })
  })

  describe("Yield statements", () => {
    test("formats yield statements correctly", () => {
      const source = dedent`
        <div>
          <%= yield %>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div><%= yield %></div>
      `)
    })

    test("formats yield with arguments", () => {
      const source = dedent`
        <div>
          <%= yield(:header) %>
          <%= yield :footer, class: "mt-4" %>
        </div>
      `

      const result = formatter.format(source)
      expect(result).toEqual(source)
    })
  })

  describe("Case statements", () => {
    test("formats case/when statements", () => {
      const source = dedent`
        <% case status
           when 'active' %>
          <span class="badge-active">Active</span>
        <% when 'inactive' %>
          <span class="badge-inactive">Inactive</span>
        <% else %>
          <span class="badge-unknown">Unknown</span>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <% case status
           when 'active' %>
          <span class="badge-active">Active</span>
        <% when 'inactive' %>
          <span class="badge-inactive">Inactive</span>
        <% else %>
          <span class="badge-unknown">Unknown</span>
        <% end %>
      `)
    })
  })

  describe("Comments", () => {
    test("formats ERB comments correctly", () => {
      const source = dedent`
        <%# This is a comment %>
        <div>Content</div>
        <% # Another comment style %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <%# This is a comment %>
        <div>Content</div>

        <% # Another comment style %>
      `)
    })
  })

  describe("Block statements", () => {
    test("formats blocks correctly", () => {
      const source = dedent`
        <% items.each do |item| %>
          <div><%= item.name %></div>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% items.each do |item| %>
          <div><%= item.name %></div>
        <% end %>
      `)
    })

    test("formats nested blocks", () => {
      const source = dedent`
        <% categories.each do |category| %>
          <div class="category">
            <h3><%= category.name %></h3>
            <% category.items.each do |item| %>
              <div class="item"><%= item.name %></div>
            <% end %>
          </div>
        <% end %>
      `

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% categories.each do |category| %>
          <div class="category">
            <h3><%= category.name %></h3>

            <% category.items.each do |item| %>
              <div class="item"><%= item.name %></div>
            <% end %>
          </div>
        <% end %>
      `)
    })
  })
})
