import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLAttributeEqualsSpacingRule } from "../../src/rules/html-attribute-equals-spacing.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAttributeEqualsSpacingRule)

describe("HTMLAttributeEqualsSpacingRule", () => {
  test("valid attributes with no spacing around equals", () => {
    expectNoOffenses(dedent`
      <div class="container"></div>
      <img src="/logo.png" alt="Logo">
      <input type="text" value="<%= @value %>">
    `)
  })

  test("attribute with space before equals", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    assertOffenses(dedent`
      <div class ="container"></div>
    `)
  })

  test("attribute with space after equals", () => {
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <img src= "/logo.png">
    `)
  })

  test("attribute with spaces both before and after equals", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <input type = "text">
    `)
  })

  test("attribute value without quotes and spaces after equals", () => {
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <div class=  data></div>
    `)
  })

  test("attribute with static and dynamic ERB before equals", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    assertOffenses(dedent`
      <div data-<%= key %>  ="value"></div>
    `)
  })

  test("attribute with ERB before equals", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    assertOffenses(dedent`
      <div <%= key %>  ="value"></div>
    `)
  })

  test("attribute with static, dynamic ERB, static before equals", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    assertOffenses(dedent`
      <div data-<%= key %>-user  ="value"></div>
    `)
  })

  test("attribute value with ERB and spaces after equals", () => {
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <div class=   <%= key %>></div>
    `)
  })

  test("attribute with static, dynamic ERB, static after equals", () => {
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <div class=  "data-<%= key %>-user  "></div>
    `)
  })

  test("multiple attributes with various spacing issues", () => {
    expectError("Remove whitespace before `=` in HTML attribute")
    expectError("Remove whitespace after `=` in HTML attribute")
    expectError("Remove whitespace before `=` in HTML attribute")
    expectError("Remove whitespace after `=` in HTML attribute")
    assertOffenses(dedent`
      <div class ="container" id= "main" data-value = "test"></div>
    `)
  })

  test("attributes without values should not trigger rule", () => {
    expectNoOffenses(dedent`
      <input disabled required>
    `)
  })
})
