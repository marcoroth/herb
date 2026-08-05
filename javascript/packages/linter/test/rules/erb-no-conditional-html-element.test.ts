import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBNoConditionalHTMLElementRule } from "../../src/rules/erb-no-conditional-html-element.js";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoConditionalHTMLElementRule)

describe("erb-no-conditional-html-element", () => {
  describe("valid cases - no conditional elements", () => {
    it("should allow normal if statements", () => {
      const html = dedent`
        <% if true %>
          <div>Text1</div>
        <% end %>
      `

      expectNoOffenses(html)
    })

    it("should allow if/else with complete elements in each branch", () => {
      const html = dedent`
        <% if some_condition %>
          <div class="a">Content</div>
        <% else %>
          <div class="b">Content</div>
        <% end %>
      `

      expectNoOffenses(html)
    })

    it("should allow conditional classes using ternary", () => {
      const html = dedent`
        <div class="<%= some_condition ? "a" : "b" %>">
          Content
        </div>
      `

      expectNoOffenses(html)
    })

    it("should allow using capture block pattern", () => {
      const html = dedent`
        <% content = capture do %>
          <div>Stuff</div>
        <% end %>

        <%= wrap_in_dialog? ? content_tag(:dialog, content) : content %>
      `

      expectNoOffenses(html)
    })

    it("should allow unless with complete element", () => {
      const html = dedent`
        <% unless hide_icon? %>
          <div class="icon">
            <span>Icon</span>
          </div>
        <% end %>
      `

      expectNoOffenses(html)
    })
  })

  describe("GitHub issue #84 - opening/closing element in separate contexts", () => {
    it("should report conditional element with if blocks", () => {
      const html = dedent`
        <% if @with_icon %>
          <h1>
        <% end %>

          Content

        <% if @with_icon %>
          </h1>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<h1>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @with_icon ? content_tag(:h1, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("GitHub issue #399 - formatter issue with conditional tags", () => {
    it("should report conditional dialog element", () => {
      const html = dedent`
        <% if wrap_in_dialog? %>
          <dialog>
        <% end %>

        <div>Stuff</div>

        <% if wrap_in_dialog? %>
          </dialog>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<dialog>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= wrap_in_dialog? ? content_tag(:dialog, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("GitHub issue #856 - incorrect MissingClosingTagError", () => {
    it("should report conditional div element (primer/view_components example)", () => {
      const html = dedent`
        <% if @with_icon %>
          <div class="icon">
        <% end %>
        <span>Content</span>
        <% if @with_icon %>
          </div>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<div>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @with_icon ? content_tag(:div, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("GitHub issue #1033 - question about conditional wrapping", () => {
    it("should report conditional div wrapper", () => {
      const html = dedent`
        <% if wrap_in_div %>
          <div>
        <% end %>
        <p>My text here.</p>
        <% if wrap_in_div %>
          </div>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<div>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= wrap_in_div ? content_tag(:div, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("GitHub issue #779 - conditional HTML open tag in if/else", () => {
    it("should report conditional div with attributes in if/else", () => {
      const html = dedent`
        <% if @show_wrapper %>
          <div class="wrapper">
        <% end %>
        <span>Content</span>
        <% if @show_wrapper %>
          </div>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<div>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @show_wrapper ? content_tag(:div, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("unless conditionals", () => {
    it("should report conditional element with unless blocks", () => {
      const html = dedent`
        <% unless hide_wrapper? %>
          <section>
        <% end %>
        <article>Main content</article>
        <% unless hide_wrapper? %>
          </section>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<section>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= hide_wrapper? ? content_tag(:section, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("nested conditional elements", () => {
    it("should report multiple nested conditional elements", () => {
      const html = dedent`
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

      expectError(dedent`
        Avoid opening and closing \`<div>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @outer ? content_tag(:div, content) : content %>
      `)
      expectError(dedent`
        Avoid opening and closing \`<span>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @inner ? content_tag(:span, content) : content %>
      `)
      assertOffenses(html)
    })
  })

  describe("conditional element with body content", () => {
    it("should report conditional element containing other elements", () => {
      const html = dedent`
        <% if @use_wrapper %>
          <main>
        <% end %>
        <header>Header</header>
        <section>Content</section>
        <footer>Footer</footer>
        <% if @use_wrapper %>
          </main>
        <% end %>
      `

      expectError(dedent`
        Avoid opening and closing \`<main>\` tags in separate conditional blocks with the same condition. This pattern is difficult to read and maintain. Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= @use_wrapper ? content_tag(:main, content) : content %>
      `)
      assertOffenses(html)
    })
  })
})
