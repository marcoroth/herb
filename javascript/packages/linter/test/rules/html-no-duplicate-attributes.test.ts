import { describe, test } from "vitest"
import { HTMLNoDuplicateAttributesRule } from "../../src/rules/html-no-duplicate-attributes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoDuplicateAttributesRule)

describe("html-no-duplicate-attributes", () => {
  test("passes for unique attributes", () => {
    expectNoOffenses(`<input type="text" name="username" id="user-id">`)
  })

  test("fails for duplicate attributes", () => {
    expectError('Duplicate attribute `type` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<input type="text" type="password" name="username">`)
  })

  test("fails for multiple duplicate attributes", () => {
    expectError('Duplicate attribute `type` found on tag. Remove the duplicate occurrence.')
    expectError('Duplicate attribute `class` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<button type="submit" type="button" class="btn" class="primary">`)
  })

  test("handles case-insensitive duplicates", () => {
    expectError('Duplicate attribute `class` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<div Class="container" class="active">`)
  })

  test("passes for different attributes", () => {
    expectNoOffenses(`<div class="container" id="main" data-value="test">`)
  })

  test("handles self-closing tags", () => {
    expectError('Duplicate attribute `src` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<img src="/logo.png" src="/backup.png" alt="Logo">`)
  })

  test("handles ERB templates with attributes", () => {
    expectNoOffenses(`<div class="<%= classes %>" data-id="<%= item.id %>">`)
  })

  test("ignores closing tags", () => {
    expectNoOffenses(`<div class="test"></div>`)
  })
})
