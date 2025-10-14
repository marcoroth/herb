import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoCaseNodeChildrenRule } from "../../src/rules/erb-no-case-node-children.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoCaseNodeChildrenRule)

describe("ERBNoCaseNodeChildrenRule", () => {
  describe("case/when", () => {
    test("valid case/when with no children", () => {
      expectNoOffenses(dedent`
        <% case count %>
        <% when 1 %>
          1
        <% when 2 %>
          2
        <% else %>
          Other
        <% end %>
      `)
    })

    test("valid case/when with only whitespace children", () => {
      expectNoOffenses(dedent`
        <% case count %>

        <% when 1 %>
          1
        <% when 2 %>
          2
        <% end %>
      `)
    })

    test("valid case/when with newline", () => {
      expectNoOffenses(dedent`
        <% case count %>
        <% when 1 %>
          One
        <% end %>
      `)
    })

    test("valid case/when with HTML comment", () => {
      expectNoOffenses(dedent`
        <% case count %>
          <!-- This is a comment -->
        <% when 1 %>
          One
        <% end %>
      `)
    })

    test("valid case/when with ERB comment", () => {
      expectNoOffenses(dedent`
        <% case count %>
          <%# This is an ERB comment %>
        <% when 1 %>
          One
        <% end %>
      `)
    })

    test("invalid case/when with HTML content", () => {
      expectError("Do not place `<h1>Content</h1>` between `<% case count %>` and `<% when 1 %>`. Content here is not part of any branch and will not be rendered.")

      assertOffenses(dedent`
        <% case count %>
          <h1>Content</h1>
        <% when 1 %>
          1
        <% when 2 %>
          2
        <% else %>
          Other
        <% end %>
      `)
    })

    test("invalid case/when with text content", () => {
      expectError("Do not place `This content is outside of any when/else block!` between `<% case variable %>` and `<% when \"a\" %>`. Content here is not part of any branch and will not be rendered.")

      assertOffenses(dedent`
        <% case variable %>
          This content is outside of any when/else block!
        <% when "a" %>
          A
        <% when "b" %>
          B
        <% end %>
      `)
    })

    test("invalid case/when with mixed content", () => {
      expectError("Do not place `<div>Invalid</div>` between `<% case status %>` and `<% when :active %>`. Content here is not part of any branch and will not be rendered.")

      assertOffenses(dedent`
        <% case status %>
          <div>Invalid</div>
        <% when :active %>
          Active
        <% end %>
      `)
    })
  })

  describe("case/in", () => {
    test("valid case/in with no children", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% in 1 %>
          One
        <% in 2 %>
          Two
        <% else %>
          Other
        <% end %>
      `)
    })

    test("valid case/in with only whitespace children", () => {
      expectNoOffenses(dedent`
        <% case value %>

        <% in 1 %>
          One
        <% in 2 %>
          Two
        <% end %>
      `)
    })

    test("valid case/in with HTML comment", () => {
      expectNoOffenses(dedent`
        <% case value %>
          <!-- Comment -->
        <% in 1 %>
          One
        <% end %>
      `)
    })

    test("valid case/in with ERB comment", () => {
      expectNoOffenses(dedent`
        <% case value %>
          <%# Comment %>
        <% in 1 %>
          One
        <% end %>
      `)
    })

    test("invalid case/in with HTML content", () => {
      expectError("Do not place `<p>Should not be here</p>` between `<% case value %>` and `<% in 1 %>`. Content here is not part of any branch and will not be rendered.")

      assertOffenses(dedent`
        <% case value %>
          <p>Should not be here</p>
        <% in 1 %>
          One
        <% in 2 %>
          Two
        <% end %>
      `)
    })

    test("invalid case/in with text content", () => {
      expectError("Do not place `Orphaned text` between `<% case value %>` and `<% in \"a\" %>`. Content here is not part of any branch and will not be rendered.")

      assertOffenses(dedent`
        <% case value %>
          Orphaned text
        <% in "a" %>
          A
        <% end %>
      `)
    })
  })
})
