import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HerbDisableCommentUnnecessaryRule } from "../../src/rules/herb-disable-comment-unnecessary.js"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"
import { ERBCommentSyntax } from "../../src/rules/erb-comment-syntax.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest([
  HerbDisableCommentUnnecessaryRule,
  HTMLTagNameLowercaseRule,
  HTMLAttributeDoubleQuotesRule,
  ERBCommentSyntax,
])

describe("HerbDisableCommentUnnecessaryRule", () => {
  test("does not warn when disable comment disables an actual offense", () => {
    expectNoOffenses(dedent`
      <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("warns when disable comment doesn't disable anything", () => {
    expectWarning("No offenses from `html-tag-name-lowercase` on this line. Remove the `herb:disable` comment.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("warns when disable comment for multiple rules doesn't disable anything", () => {
    expectWarning("No offenses from rules `html-tag-name-lowercase`, `html-attribute-double-quotes` on this line. Remove them from the `herb:disable` comment.")

    assertOffenses(dedent`
      <div id="test">content</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("does not warn when 'all' disables an actual offense", () => {
    expectNoOffenses(dedent`
      <DIV>test</DIV> <%# herb:disable all %>
    `)
  })

  test("warns when 'all' doesn't disable anything", () => {
    expectWarning("No offenses to disable on this line. Remove the `herb:disable all` comment.")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("handles multiple disable comments correctly", () => {
    expectWarning("No offenses from `html-tag-name-lowercase` on this line. Remove the `herb:disable` comment.", { line: 1 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase %>
      <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("warns about specific unused rule when one of multiple rules is used", () => {
    expectWarning("No offenses from `html-tag-name-lowercase` on this line. Remove it from the `herb:disable` comment.")

    assertOffenses(dedent`
      <div id='test'>content</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("warns about specific unused rule with uppercase tag example", () => {
    expectWarning("No offenses from `erb-comment-syntax` on this line. Remove it from the `herb:disable` comment.")

    assertOffenses(dedent`
      <DIV></DIV><%# herb:disable html-tag-name-lowercase, erb-comment-syntax %>
    `)
  })

  test("does not warn when all rules in disable comment are actually used", () => {
    expectNoOffenses(dedent`
      <DIV id='test'>content</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
    `)
  })

  test("ignores invalid rule names and only checks valid ones", () => {
    expectNoOffenses(dedent`
      <DIV></DIV><%# herb:disable invalid-rule-name, html-tag-name-lowercase %>
    `)
  })

  test("ignores invalid rule names when reporting unnecessary ones", () => {
    expectWarning("No offenses from `html-tag-name-lowercase` on this line. Remove the `herb:disable` comment.")

    assertOffenses(dedent`
      <div></div><%# herb:disable invalid-rule-name, html-tag-name-lowercase %>
    `)
  })

  test("doesn't report when 'all' is used with specific rules (handled by redundant-all rule)", () => {
    expectNoOffenses(dedent`
      <DIV></DIV><%# herb:disable all, html-tag-name-lowercase %>
    `)
  })
})
