import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbDisableCommentMalformedRule } from "../../src/rules/herb-disable-comment-malformed.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbDisableCommentMalformedRule)

describe("HerbDisableCommentMalformedRule", () => {
  test("allows valid herb:disable with single rule", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("allows valid herb:disable with multiple rules", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("allows valid herb:disable with all", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("allows empty herb:disable (handled by missing-rules)", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable %>
    `)
  })

  test("flags trailing comma", () => {
    expectError("`herb:disable` comment has a trailing comma. Remove the trailing comma.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable abc, %>
    `)
  })

  test("flags trailing comma with all", () => {
    expectError("`herb:disable` comment has a trailing comma. Remove the trailing comma.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable all, %>
    `)
  })

  test("flags trailing comma with multiple rules", () => {
    expectError("`herb:disable` comment has a trailing comma. Remove the trailing comma.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable rule1, rule2, %>
    `)
  })

  test("flags leading comma", () => {
    expectError("`herb:disable` comment starts with a comma. Remove the leading comma.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable ,rule1 %>
    `)
  })

  test("flags consecutive commas", () => {
    expectError("`herb:disable` comment has consecutive commas. Remove extra commas.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable rule1,,rule2 %>
    `)
  })

  test("flags consecutive commas with spaces", () => {
    expectError("`herb:disable` comment has consecutive commas. Remove extra commas.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable rule1, , rule2 %>
    `)
  })

  test("ignores regular comments", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# Just a regular comment %>
    `)
  })

  test("ignores comments that don't start with herb:disable", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# This mentions herb:disable but doesn't start with it %>
    `)
  })

  test("flags missing space after herb:disable", () => {
    expectError("`herb:disable` comment is missing a space after `herb:disable`. Add a space before the rule names.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disableall %>
    `)
  })

  test("flags missing space with rule name", () => {
    expectError("`herb:disable` comment is missing a space after `herb:disable`. Add a space before the rule names.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disablehtml-tag-name-lowercase %>
    `)
  })
})
