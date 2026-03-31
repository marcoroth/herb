import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoStyleAttributesRule } from "../../src/rules/html-no-style-attributes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoStyleAttributesRule)

describe("html-no-style-attributes", () => {
  test("passes with class attribute", () => {
    expectNoOffenses(dedent`
      <button class="btn btn-primary">Submit</button>
    `)
  })

  test("passes with data attributes", () => {
    expectNoOffenses(dedent`
      <div data-controller="hello" data-action="click->hello#greet">Content</div>
    `)
  })

  test("fails with inline style attribute", () => {
    expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

    assertOffenses(dedent`
      <button style="color: red;">Submit</button>
    `)
  })

  test("fails with ERB tag in style attribute", () => {
    expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

    assertOffenses(dedent`
      <div style="<%= custom_styles %>">Content</div>
    `)
  })

  test("fails with ERB interpolation within style value", () => {
    expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

    assertOffenses(dedent`
      <div style="max-width: <%= yield(:content_max_width).presence || "600px" %>;">Content</div>
    `)
  })

  test("fails with url() containing ERB in style attribute", () => {
    expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

    assertOffenses(dedent`
      <div style="background-image: url(<%= asset_path('bg.svg') %>); width: 593px;">Content</div>
    `)
  })

  describe("Action View helpers", () => {
    test("passes for tag.div without style", () => {
      expectNoOffenses('<%= tag.div class: "container" %>')
    })

    test("fails for tag.div with style", () => {
      expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

      assertOffenses('<%= tag.div style: "color: red" %>')
    })

    test("passes for content_tag without style", () => {
      expectNoOffenses('<%= content_tag :div, "content", class: "main" %>')
    })

    test("fails for content_tag with style", () => {
      expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

      assertOffenses('<%= content_tag :div, "content", style: "color: red" %>')
    })

    test("passes for link_to without style", () => {
      expectNoOffenses('<%= link_to "About", "/about", class: "link" %>')
    })

    test("fails for link_to with style", () => {
      expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

      assertOffenses('<%= link_to "About", "/about", style: "color: red" %>')
    })

    test("fails for link_to block with style", () => {
      expectWarning("Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.")

      assertOffenses(dedent`
        <%= link_to "https://example.com", style: "display: inline-block;" do %>
          <span>Click here</span>
        <% end %>
      `)
    })
  })
})
