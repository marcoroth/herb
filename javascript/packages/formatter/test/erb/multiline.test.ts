import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

// https://github.com/marcoroth/herb/issues/1835
//
// When the source has a newline immediately after the opening tag (`<%=` or
// `<%`), the formatter should keep the tag expanded with the opening and
// closing delimiters on their own lines, rather than squashing the first line
// of Ruby onto the opening delimiter. This mirrors how Prettier preserves
// user-authored expansion of object literals, and how the formatter already
// renders multi-line ERB comments.
describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  describe("multi-line ERB output tags (issue 1835)", () => {
    test("preserves newline after opening tag at top-level", () => {
      expectFormattedToMatch(dedent`
        <%=
          link_to(
            sanitize(t("views.pagination.first")),
            url,
            remote:,
            class: "page-link",
            tabindex: current_page.first? ? -1 : nil
          )
        %>
      `)
    })

    test("preserves newline after opening tag inside an element", () => {
      expectFormattedToMatch(dedent`
        <li class="<%= class_names("page-item user-select-none", disabled: current_page.first?) %>">
          <%=
            link_to(
              sanitize(t("views.pagination.first")),
              url,
              remote:,
              class: "page-link",
              tabindex: current_page.first? ? -1 : nil
            )
          %>
        </li>
      `)
    })

    test("preserves newline after opening tag for non-output ERB tags", () => {
      expectFormattedToMatch(dedent`
        <%
          pagination_options = {
            remote:,
            class: "page-link"
          }
        %>
      `)
    })

    test("still squashes multi-line content without a leading newline", () => {
      expectFormattedToMatch(dedent`
        <%= link_to(
          sanitize(t("views.pagination.first")),
          url,
          remote:
        ) %>
      `)
    })

    test("balances a tag with a leading newline but inline closing delimiter", () => {
      const source = dedent`
        <%=
          link_to(
            "First",
            url
          ) %>
      `
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <%=
          link_to(
            "First",
            url
          )
        %>
      `)
    })

    test("re-indents content relative to the tag's indentation", () => {
      const source = [
        `<div>`,
        `<%=`,
        `link_to(`,
        `  "First",`,
        `  url`,
        `)`,
        `%>`,
        `</div>`,
      ].join("\n")

      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <div>
          <%=
            link_to(
              "First",
              url
            )
          %>
        </div>
      `)
    })

    test("preserves relative indentation of content lines", () => {
      expectFormattedToMatch(dedent`
        <%=
          content_tag(
            :span,
            title,
            data: {
              controller: "tooltip"
            }
          )
        %>
      `)
    })

    test("is idempotent across multiple passes", () => {
      expectFormattedToMatch(
        dedent`
          <li>
            <%=
              link_to(
                "First",
                url
              )
            %>
          </li>
        `,
        { passes: 3 },
      )
    })

    test("single-line output tags are unaffected", () => {
      expectFormattedToMatch(`<%= title %>`)
    })

    test("collapses a leading newline when content is a single line", () => {
      const source = `<%=\n  title %>`
      const result = formatter.format(source)

      expect(result).toEqual(`<%= title %>`)
    })

    test("does not expand control-flow opening tags", () => {
      const source = dedent`
        <%
          if current_page.first? %>
          <span>First</span>
        <% end %>
      `
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <% if current_page.first? %>
          <span>First</span>
        <% end %>
      `)
    })

    test("squashes multi-line ERB inside attribute values", () => {
      const source = dedent`
        <li class="<%=
          class_names(
            "page-item",
            disabled: current_page.first?
          )
        %>">First</li>
      `
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <li class="<%= class_names( "page-item", disabled: current_page.first? ) %>">
          First
        </li>
      `)
    })

    test("does not expand ERB tags in inline text flow", () => {
      expectFormattedToMatch(dedent`
        <p>Showing <%= offset %> of <%= total %> results</p>
      `)
    })

    test("expanded output tags coexist with heredoc handling (issue 476)", () => {
      expectFormattedToMatch(dedent`
        <%= <<~HTML.html_safe
          <span>First</span>
        HTML
        %>
      `)
    })

    test("does not re-indent heredoc bodies inside expanded tags", () => {
      expectFormattedToMatch(dedent`
        <%=
          tag.pre(<<~TEXT)
            significant
              leading
            whitespace
          TEXT
        %>
      `)
    })
  })
})
