import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbDisableCommentNoRedundantAllRule } from "../../src/rules/herb-disable-comment-no-redundant-all.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbDisableCommentNoRedundantAllRule)

describe("HerbDisableCommentNoRedundantAllRule", () => {
  test("allows 'all' by itself", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("allows specific rule names without 'all'", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("warns when 'all' is used with specific rule names", () => {
    expectWarning("Using `all` with specific rules is redundant. Use `herb:disable all` by itself or list only specific rules.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable all, html-tag-name-lowercase %>
    `)
  })

  test("warns when 'all' is used with multiple specific rule names", () => {
    expectWarning("Using `all` with specific rules is redundant. Use `herb:disable all` by itself or list only specific rules.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, all, html-attribute-double-quotes %>
    `)
  })

  test("warns when 'all' appears first with other rules", () => {
    expectWarning("Using `all` with specific rules is redundant. Use `herb:disable all` by itself or list only specific rules.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable all, html-attribute-double-quotes %>
    `)
  })

  test("warns when 'all' appears last with other rules", () => {
    expectWarning("Using `all` with specific rules is redundant. Use `herb:disable all` by itself or list only specific rules.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-attribute-double-quotes, all %>
    `)
  })

  test("ignores non-herb:disable comments", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# This is just a regular comment %>
    `)
  })
})
