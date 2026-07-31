import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBNoCommentedOutOutputTagsRule } from "../../src/rules/erb-no-commented-out-output-tags";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ERBNoCommentedOutOutputTagsRule)

describe("erb-no-commented-out-output-tags", () => {
  it("should report a commented out output tag without whitespace", () => {
    expectInfo("`<%#=` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%=` if it's still needed.", [1, 0])

    assertOffenses(dedent`
      <%#= link_to "New watch list", new_watch_list_path %>
    `)
  })

  it("should report a commented out output tag with whitespace after the hash", () => {
    expectInfo("`<%# =` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%=` if it's still needed.", [1, 0])

    assertOffenses(dedent`
      <%# = link_to "New watch list", new_watch_list_path %>
    `)
  })

  it("should report a commented out raw output tag", () => {
    expectInfo("`<%#==` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%==` if it's still needed.", [1, 0])

    assertOffenses(dedent`
      <%#== raw_content %>
    `)
  })

  it("should report a commented out raw output tag with whitespace after the hash", () => {
    expectInfo("`<%# ==` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%==` if it's still needed.", [1, 0])

    assertOffenses(dedent`
      <%# == raw_content %>
    `)
  })

  it("should report each commented out tag separately", () => {
    expectInfo("`<%#=` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%=` if it's still needed.", [1, 0])
    expectInfo("`<%# =` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%=` if it's still needed.", [3, 0])

    assertOffenses(dedent`
      <%#= user.name %>
      <%= user.email %>
      <%# = user.address %>
    `)
  })

  it("should not report regular prose comments", () => {
    expectNoOffenses(dedent`
      <%# This is a comment %>
      <%# hello world %>
      <%# TODO: revisit this %>
    `)
  })

  it("should not report comments used as section dividers", () => {
    expectNoOffenses(dedent`
      <%# === Section === %>
      <%# ==== %>
      <%#=== Section %>
    `)
  })

  it("should not report regular ERB tags", () => {
    expectNoOffenses(dedent`
      <%= user.name %>
      <% if admin %>
        Hello, admin.
      <% end %>
      <%== raw_content %>
    `)
  })

  it("should not report empty comment tags", () => {
    expectNoOffenses(dedent`
      <%# %>
      <%#%>
    `)
  })

  it("should not report a comment where the equals sign is on a later line", () => {
    expectNoOffenses(dedent`
      <%#
        = link_to "New watch list", new_watch_list_path
      %>
    `)
  })

  it("should not report herb:disable directives", () => {
    expectNoOffenses(dedent`
      <%# herb:disable erb-no-extra-whitespace-inside-tags %>
    `)
  })
})
