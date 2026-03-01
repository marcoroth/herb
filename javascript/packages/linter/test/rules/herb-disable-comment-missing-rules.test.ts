import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbDisableCommentMissingRulesRule } from "../../src/rules/herb-disable-comment-missing-rules.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbDisableCommentMissingRulesRule)

describe("HerbDisableCommentMissingRulesRule", () => {
  test("flags herb:disable with no rules", () => {
    expectError("`herb:disable` comment is missing rule names. Specify `all` or list specific rules to disable.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable %>
    `)
  })

  test("flags herb:disable with only whitespace", () => {
    expectError("`herb:disable` comment is missing rule names. Specify `all` or list specific rules to disable.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable   %>
    `)
  })

  test("allows herb:disable with 'all'", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("allows herb:disable with specific rule name", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("allows herb:disable with multiple rule names", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("ignores regular ERB comments", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# This is just a regular comment %>
    `)
  })

  test("ignores ERB comments that start with herb:disable but have content after", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable-like comment %>
    `)
  })
})
