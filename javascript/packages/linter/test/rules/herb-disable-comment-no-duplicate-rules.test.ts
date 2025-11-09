import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbDisableCommentNoDuplicateRulesRule } from "../../src/rules/herb-disable-comment-no-duplicate-rules.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbDisableCommentNoDuplicateRulesRule)

describe("HerbDisableCommentNoDuplicateRulesRule", () => {
  test("allows unique rule names", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("allows single rule name", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("allows 'all' by itself", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("warns on duplicate rule names", () => {
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 58 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-tag-name-lowercase %>
    `)
  })

  test("warns on duplicate with multiple rules", () => {
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 88 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-attribute-double-quotes, html-tag-name-lowercase, html-tag-name-lowercase %>
    `)
  })

  test("warns on multiple duplicates", () => {
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 58 })
    expectWarning("Duplicate rule `html-attribute-double-quotes` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 113 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-tag-name-lowercase, html-attribute-double-quotes, html-attribute-double-quotes %>
    `)
  })

  test("warns on triple duplicate", () => {
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 58 })
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 83 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-tag-name-lowercase, html-tag-name-lowercase %>
    `)
  })

  test("warns on duplicate 'all'", () => {
    expectWarning("Duplicate rule `all` in `herb:disable` comment. Remove the duplicate.", { line: 1, column: 38 })

    assertOffenses(`<div>test</div> <%# herb:disable all, all %>`)
  })

  test("ignores non-herb:disable comments", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# This is just a regular comment %>
    `)
  })

  test("handles whitespace variations", () => {
    expectWarning("Duplicate rule `html-tag-name-lowercase` in `herb:disable` comment. Remove the duplicate.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase,html-tag-name-lowercase %>
    `)
  })
})
