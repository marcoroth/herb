import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"
import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("ERB Formatter Additional Tests", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  describe("Basic formatting edge cases", () => {
    test("formats simple tags with extra whitespace", () => {
      const source = "<div        > asdf    </div>"

      const result = formatter.format(source)

      expect(result).toBe(`<div>asdf</div>`)
    })

    test("handles custom tag names with dashes", () => {
      const source = "<custom-div        > asdf    </custom-div>"

      const result = formatter.format(source)

      expect(result).toBe(`<custom-div>asdf</custom-div>`)
    })

    test("handles very long text content with proper wrapping", () => {
      const source = dedent`
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo <span>co<strong>nse</strong>quat.</span> Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
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
  })

  describe("Complex Ruby formatting", () => {
    test("formats complex Ruby render calls", () => {
      const source =
        "<div> <%=render MyComponent.new(foo:barbarbarbarbarbarbarbar,bar:bazbazbazbazbazbazbazbaz)%> </div>"

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <%= render MyComponent.new(foo:barbarbarbarbarbarbarbar,bar:bazbazbazbazbazbazbazbaz) %>
        </div>
      `)
    })

    test("handles complex ERB with vite and stylesheet tags", () => {
      const source = dedent`
        <%- vite_client_tag %>
        <%= vite_typescript_tag "application", "data-turbo-track": "reload", defer: true %>
        <%= stylesheet_link_tag "tailwind",
        "inter-font",
        "data-turbo-track": "reload",
        defer: true %>
        <%= stylesheet_link_tag "polaris_view_components",
        "data-turbo-track": "reload",
        defer: true %>
        <%- hotwire_livereload_tags if Rails.env .development? %>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <%- vite_client_tag %>
        <%= vite_typescript_tag "application", "data-turbo-track": "reload", defer: true %>

        <%= stylesheet_link_tag "tailwind",
        "inter-font",
        "data-turbo-track": "reload",
        defer: true %>

        <%= stylesheet_link_tag "polaris_view_components",
        "data-turbo-track": "reload",
        defer: true %>

        <%- hotwire_livereload_tags if Rails.env .development? %>
      `)
    })
  })

  describe("Deep nesting scenarios", () => {
    test("handles extremely deep nesting with long text", () => {
      const openTags = Array(10).fill("<div>").join("\n")
      const closeTags = Array(10).fill("</div>").join("\n")
      const longText = "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."

      const source = `${openTags}\n${longText}\n${closeTags}`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <div>
                      <div>
                        <div>
                          <div>
                            Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                            sed do eiusmod tempor incididunt ut labore et dolore magna
                            aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                            ullamco laboris nisi ut aliquip ex ea commodo consequat.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `)
    })

    test("handles mixed content with deep nesting", () => {
      const source = dedent`
        <div>
          <div>
            <div>
              <span>Short text</span>
              <p>In the event we decide to issue a refund, we will reimburse you no later than fourteen (14) days from the date on which we make that determination. We will use the same means of payment as You used for the Order, and You will not incur any fees for such reimbursement.</p>
            </div>
          </div>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div>
          <div>
            <div>
              <span>Short text</span>

              <p>
                In the event we decide to issue a refund, we will reimburse you no later
                than fourteen (14) days from the date on which we make that
                determination. We will use the same means of payment as You used for the
                Order, and You will not incur any fees for such reimbursement.
              </p>
            </div>
          </div>
        </div>
      `)
    })
  })

  describe("Error handling", () => {
    test("handles unmatched ERB tags gracefully", () => {
      expectFormattedToMatch(dedent`
        <% if true %>
          <h1>
            <%= link_to 'New Order', new_order_path, class: "btn btn-success" %>
            <% end %>
          </h1>
      `)
    })
  })

  describe("UTF-8 and special characters", () => {
    test("preserves UTF-8 characters in various contexts", () => {
      const source = dedent`
        <div data-emoji="🚀" title="Тест">
          <p>Café naïve résumé 中文测试</p>
          <%= "🍰" * 10 %>
        </div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-emoji="🚀" title="Тест">
          <p>Café naïve résumé 中文测试</p>
          <%= "🍰" * 10 %>
        </div>
      `)
    })
  })

  describe("Attribute handling edge cases", () => {
    test("handles mixed quote types in attributes", () => {
      const source = `<input type='text' name="user[email]" data-test='value "with" quotes' />`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <input type="text" name="user[email]" data-test='value "with" quotes' />
      `)
    })

    test("handles attributes without values", () => {
      const source = `<input type="text" required disabled readonly />`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <input
          type="text"
          required
          disabled
          readonly
        />
      `)
    })
  })
})
