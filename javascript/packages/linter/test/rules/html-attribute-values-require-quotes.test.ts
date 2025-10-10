import { describe, test } from "vitest"
import { HTMLAttributeValuesRequireQuotesRule } from "../../src/rules/html-attribute-values-require-quotes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAttributeValuesRequireQuotesRule)

describe("html-attribute-values-require-quotes", () => {
  test("passes for quoted attribute values", () => {
    expectNoOffenses(`<div id="hello" class="container"></div>`)
  })

  test("fails for unquoted attribute values", () => {
    expectError('Attribute value should be quoted: `id="hello"`. Always wrap attribute values in quotes.')
    expectError('Attribute value should be quoted: `class="container"`. Always wrap attribute values in quotes.')
    assertOffenses(`<div id=hello class=container></div>`)
  })

  test("passes for single-quoted values", () => {
    expectNoOffenses(`<div id='hello' class='container'></div>`)
  })

  test("passes for boolean attributes without values", () => {
    expectNoOffenses(`<input type="text" disabled />`)
  })

  test("handles mixed quoted and unquoted", () => {
    expectError('Attribute value should be quoted: `name="username"`. Always wrap attribute values in quotes.')
    assertOffenses(`<input type="text" name=username value="test" />`)
  })

  test("handles ERB in quoted attributes", () => {
    expectNoOffenses(`<div class="<%= classes %>" data-id="<%= item.id %>"></div>`)
  })

  test("handles ERB in unquoted attributes", () => {
    expectError('Attribute value should be quoted: `class="<%= classes %>"`. Always wrap attribute values in quotes.')
    assertOffenses(`<div class=<%= classes %>></div>`)
  })

  test("handles self-closing tags", () => {
    expectError('Attribute value should be quoted: `src="photo"`. Always wrap attribute values in quotes.')
    assertOffenses(`<img src=photo alt="Photo" />`)
  })

  test("handles complex attribute values", () => {
    expectError('Attribute value should be quoted: `title="User"`. Always wrap attribute values in quotes.')
    assertOffenses(`<a href="/profile" title=User></a>`)
  })

  test("ignores closing tags", () => {
    expectNoOffenses(`<div class="test"></div>`)
  })
})
