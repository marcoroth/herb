import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoEmptyControlFlowRule } from "../../src/rules/erb-no-empty-control-flow.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectHint, assertOffenses } = createLinterTest(ERBNoEmptyControlFlowRule)

describe("ERBNoEmptyControlFlowRule", () => {
  describe("if statements", () => {
    test("detects empty if block", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition %>
        <% end %>
      `)
    })

    test("detects if block with only whitespace", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition %>


        <% end %>
      `)
    })

    test("does not flag if block with content", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <p>Content</p>
        <% end %>
      `)
    })

    test("flags empty if block even when else has content", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if true %>

        <% else %>
          a
        <% end %>
      `)
    })

    test("flags empty if block when elsif has content", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition1 %>
        <% elsif condition2 %>
          <p>Content in elsif</p>
        <% end %>
      `)
    })

    test("detects completely empty if/elsif/else chain", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition1 %>
        <% elsif condition2 %>
        <% else %>
        <% end %>
      `)
    })

    test("flags only empty elsif when if and else have content", () => {
      expectHint("Empty elsif block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition1 %>
          a
        <% elsif condition2 %>
        <% else %>
          b
        <% end %>
      `)
    })

    test("flags multiple empty blocks in if/elsif/else chain", () => {
      expectHint("Empty if block: this control flow statement has no content")
      expectHint("Empty else block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition1 %>
        <% elsif condition2 %>
          a
        <% else %>
        <% end %>
      `)
    })
  })

  describe("else statements", () => {
    test("detects completely empty if/else block", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if true %>

        <% else %>

        <% end %>
      `)
    })

    test("flags empty else when if has content", () => {
      expectHint("Empty else block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition %>
          <p>Content</p>
        <% else %>
        <% end %>
      `)
    })

    test("flags empty else block with whitespace when if has content", () => {
      expectHint("Empty else block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if true %>
          a
        <% else %>

        <% end %>
      `)
    })
  })

  describe("unless statements", () => {
    test("detects empty unless block", () => {
      expectHint("Empty unless block: this control flow statement has no content")

      assertOffenses(dedent`
        <% unless condition %>
        <% end %>
      `)
    })

    test("does not flag unless block with content", () => {
      expectNoOffenses(dedent`
        <% unless condition %>
          <p>Content</p>
        <% end %>
      `)
    })

    test("flags empty unless block even when else has content", () => {
      expectHint("Empty unless block: this control flow statement has no content")

      assertOffenses(dedent`
        <% unless condition %>
        <% else %>
          <p>Content in else</p>
        <% end %>
      `)
    })

    test("detects completely empty unless/else block", () => {
      expectHint("Empty unless block: this control flow statement has no content")

      assertOffenses(dedent`
        <% unless condition %>
        <% else %>
        <% end %>
      `)
    })

    test("flags empty else when unless has content", () => {
      expectHint("Empty else block: this control flow statement has no content")

      assertOffenses(dedent`
        <% unless true %>
          a
        <% else %>

        <% end %>
      `)
    })
  })

  describe("for loops", () => {
    test("detects empty for loop", () => {
      expectHint("Empty for block: this control flow statement has no content")

      assertOffenses(dedent`
        <% for item in items %>
        <% end %>
      `)
    })

    test("does not flag for loop with content", () => {
      expectNoOffenses(dedent`
        <% for item in items %>
          <p><%= item %></p>
        <% end %>
      `)
    })
  })

  describe("while loops", () => {
    test("detects empty while loop", () => {
      expectHint("Empty while block: this control flow statement has no content")

      assertOffenses(dedent`
        <% while condition %>
        <% end %>
      `)
    })

    test("does not flag while loop with content", () => {
      expectNoOffenses(dedent`
        <% while condition %>
          <p>Looping</p>
        <% end %>
      `)
    })
  })

  describe("until loops", () => {
    test("detects empty until loop", () => {
      expectHint("Empty until block: this control flow statement has no content")

      assertOffenses(dedent`
        <% until condition %>
        <% end %>
      `)
    })
  })

  describe("when statements", () => {
    test("detects empty when block", () => {
      expectHint("Empty when block: this control flow statement has no content")

      assertOffenses(dedent`
        <% case value %>
        <% when "a" %>
        <% when "b" %>
          <p>B</p>
        <% end %>
      `)
    })

    test("does not flag when block with then keyword as empty", () => {
      expectNoOffenses(dedent`
        <% header_error = case %>
        <% when header.blank? then t(".required") %>
        <% when @form.headers.count(header) > 1 then t(".duplicate") %>
        <% end %>
      `)
    })

    test("does not flag inline when with then as empty", () => {
      expectNoOffenses(dedent`
        <% case variable %>
        <% when String then "string" %>
        <% when Integer then "integer" %>
        <% end %>
      `)
    })

    test("does not flag when with then even if then appears in a string", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% when "then" then "matched then" %>
        <% end %>
      `)
    })
  })

  describe("in statements", () => {
    test("detects empty in block", () => {
      expectHint("Empty in block: this control flow statement has no content")

      assertOffenses(dedent`
        <% case value %>
        <% in String %>
        <% in Integer %>
          <p>Number</p>
        <% end %>
      `)
    })

    test("does not flag in block with then keyword as empty", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% in String then "string" %>
        <% in Integer then "integer" %>
        <% end %>
      `)
    })

    test("does not flag in with then even if then appears in pattern", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% in { then: x } then x %>
        <% end %>
      `)
    })
  })

  describe("begin/rescue/ensure blocks", () => {
    test("detects empty begin block", () => {
      expectHint("Empty begin block: this control flow statement has no content")

      assertOffenses(dedent`
        <% begin %>
        <% end %>
      `)
    })

    test("detects empty rescue block", () => {
      expectHint("Empty rescue block: this control flow statement has no content")

      assertOffenses(dedent`
        <% begin %>
          <p>Try this</p>
        <% rescue %>
        <% end %>
      `)
    })

    test("detects empty ensure block", () => {
      expectHint("Empty ensure block: this control flow statement has no content")

      assertOffenses(dedent`
        <% begin %>
          <p>Try this</p>
        <% ensure %>
        <% end %>
      `)
    })
  })

  describe("block statements", () => {
    test("detects empty block", () => {
      expectHint("Empty do block: this control flow statement has no content")

      assertOffenses(dedent`
        <% foo do %>
        <% end %>
      `)
    })

    test("does not flag block with content", () => {
      expectNoOffenses(dedent`
        <% foo do %>
          <p>Content</p>
        <% end %>
      `)
    })

    test("detects empty rescue in block", () => {
      expectHint("Empty rescue block: this control flow statement has no content")

      assertOffenses(dedent`
        <% 5.times do %>
          <p>Content</p>
        <% rescue %>
        <% end %>
      `)
    })

    test("detects empty ensure in block", () => {
      expectHint("Empty ensure block: this control flow statement has no content")

      assertOffenses(dedent`
        <% 5.times do %>
          <p>Content</p>
        <% ensure %>
        <% end %>
      `)
    })

    test("detects empty else in block with rescue", () => {
      expectHint("Empty else block: this control flow statement has no content")

      assertOffenses(dedent`
        <% 5.times do %>
          <p>Content</p>
        <% rescue %>
          <p>Error</p>
        <% else %>
        <% end %>
      `)
    })

    test("detects empty body and empty rescue in block", () => {
      expectHint("Empty do block: this control flow statement has no content")
      expectHint("Empty rescue block: this control flow statement has no content")

      assertOffenses(dedent`
        <% 5.times do %>
        <% rescue %>
        <% end %>
      `)
    })

    test("does not flag block with rescue that has content", () => {
      expectNoOffenses(dedent`
        <% 5.times do %>
          <p>Content</p>
        <% rescue %>
          <p>Error</p>
        <% end %>
      `)
    })

    test("does not flag block with rescue, else, and ensure that have content", () => {
      expectNoOffenses(dedent`
        <% items.each do |item| %>
          <%= item %>
        <% rescue StandardError => e %>
          <%= e.message %>
        <% else %>
          <p>Success</p>
        <% ensure %>
          <p>Cleanup</p>
        <% end %>
      `)
    })
  })

  describe("combined scenarios", () => {
    test("detects multiple empty blocks in same template", () => {
      expectHint("Empty if block: this control flow statement has no content")
      expectHint("Empty unless block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if condition %>
        <% end %>

        <% unless other %>
        <% end %>
      `)
    })

    test("detects empty nested blocks", () => {
      expectHint("Empty if block: this control flow statement has no content")

      assertOffenses(dedent`
        <% if outer %>
          <% if inner %>
          <% end %>
        <% end %>
      `)
    })
  })
})
