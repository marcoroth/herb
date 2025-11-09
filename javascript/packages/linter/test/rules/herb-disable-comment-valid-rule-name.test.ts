import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbDisableCommentValidRuleNameRule } from "../../src/rules/herb-disable-comment-valid-rule-name.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbDisableCommentValidRuleNameRule)

describe("HerbDisableCommentValidRuleNameRule", () => {
  test("allows valid single rule name", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-name %>
    `)
  })

  test("allows valid multiple rule names", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-name, erb-comment-syntax %>
    `)
  })

  test("allows 'all' as a rule name", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable all %>
    `)
  })

  test("warns on unknown single rule name", () => {
    expectWarning("Unknown rule `this-rule-doesnt-exist`. Did you mean `erb-no-empty-tags`?")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable this-rule-doesnt-exist %>
    `)
  })

  test("warns on unknown rule name in multiple rules", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-name, erb-comment-syntax %>
    `)
  })

  test("warns on multiple unknown rule names", () => {
    expectWarning("Unknown rule `unknown-rule-1`. Did you mean `all`?")
    expectWarning("Unknown rule `unknown-rule-2`. Did you mean `all`?")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable unknown-rule-1, unknown-rule-2 %>
    `)
  })

  test("provides suggestion for typo in rule name", () => {
    expectWarning("Unknown rule `herb-disable-comment-valid-rule-nam`. Did you mean `herb-disable-comment-valid-rule-name`?")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-nam %>
    `)
  })

  test("ignores non-herb:disable comments", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# This is just a regular comment %>
    `)
  })

  test("ignores Ruby comments in execution tags", () => {
    expectNoOffenses(dedent`
      <div>test</div> <% # This is a Ruby comment %>
    `)
  })

  test("handles multiple herb:disable comments", () => {
    expectWarning("Unknown rule `unknown-rule`. Did you mean `all`?")

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable unknown-rule %>
      <span>test</span> <%# herb:disable herb-disable-comment-valid-rule-name %>
    `)
  })

  test("handles whitespace variations", () => {
    expectNoOffenses(dedent`
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-name,erb-comment-syntax %>
      <div>test</div> <%# herb:disable herb-disable-comment-valid-rule-name , erb-comment-syntax %>
      <div>test</div> <%# herb:disable  herb-disable-comment-valid-rule-name  ,  erb-comment-syntax %>
    `)
  })

  test("handles multiple herb:disable on same line", () => {
    expectWarning("Unknown rule `invalid`. Did you mean `all`?")

    assertOffenses(dedent`
      <%# herb:disable invalid %> <%# herb:disable all %>
    `)
  })

  test("correctly locates rule name 'disable' after 'herb:disable'", () => {
    expectWarning("Unknown rule `disable`. Did you mean `all`?", { line: 1, column: 33 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable disable %>
    `)
  })

  test("correctly locates rule name 'herb' after 'herb:disable'", () => {
    expectWarning("Unknown rule `herb`. Did you mean `all`?", { line: 1, column: 33 })

    assertOffenses(dedent`
      <div>test</div> <%# herb:disable herb %>
    `)
  })

})
