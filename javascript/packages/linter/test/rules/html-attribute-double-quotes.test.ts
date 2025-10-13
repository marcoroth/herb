import { describe, test } from "vitest"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLAttributeDoubleQuotesRule)

describe("html-attribute-double-quotes", () => {
  test("passes for double quoted attributes", () => {
    expectNoOffenses(`<input type="text" value="Username">`)
  })

  test("fails for single quoted attributes", () => {
    expectWarning('Attribute `type` uses single quotes. Prefer double quotes for HTML attribute values: `type="text"`.')
    expectWarning('Attribute `value` uses single quotes. Prefer double quotes for HTML attribute values: `value="Username"`.')
    assertOffenses(`<input type='text' value='Username'>`)
  })

  test("passes for mixed content with double quotes", () => {
    expectNoOffenses(`<a href="/profile" title="User Profile" data-controller="dropdown">Profile</a>`)
  })

  test("fails for mixed content with single quotes", () => {
    expectWarning('Attribute `href` uses single quotes. Prefer double quotes for HTML attribute values: `href="/profile"`.')
    expectWarning('Attribute `title` uses single quotes. Prefer double quotes for HTML attribute values: `title="User Profile"`.')
    expectWarning('Attribute `data-controller` uses single quotes. Prefer double quotes for HTML attribute values: `data-controller="dropdown"`.')
    assertOffenses(`<a href='/profile' title='User Profile' data-controller='dropdown'>Profile</a>`)
  })

  test("passes for unquoted attributes (handled by other rule)", () => {
    expectNoOffenses(`<input type=text value=Username>`)
  })

  test("passes for attributes without values", () => {
    expectNoOffenses(`<input type="checkbox" checked disabled>`)
  })

  test("handles self-closing tags with single quotes", () => {
    expectWarning('Attribute `src` uses single quotes. Prefer double quotes for HTML attribute values: `src="/image.jpg"`.')
    expectWarning('Attribute `alt` uses single quotes. Prefer double quotes for HTML attribute values: `alt="Description"`.')
    assertOffenses(`<img src='/image.jpg' alt='Description' />`)
  })

  test("handles ERB with single quoted attributes", () => {
    expectWarning('Attribute `data-controller` uses single quotes. Prefer double quotes for HTML attribute values: `data-controller="<%= controller_name %>"`.')
    expectWarning('Attribute `data-action` uses single quotes. Prefer double quotes for HTML attribute values: `data-action="click->toggle#action"`.')
    assertOffenses(`<div data-controller='<%= controller_name %>' data-action='click->toggle#action'>Content</div>`)
  })

  test("handles mixed ERB with single quoted attributes", () => {
    expectWarning('Attribute `class` uses single quotes. Prefer double quotes for HTML attribute values: `class="static <%= class_list %> another-static"`.')
    assertOffenses(`<div class='static <%= class_list %> another-static'>Content</div>`)
  })

  test("allows single quotes when value contains double quotes", () => {
    expectNoOffenses(`<div id='"hello"' class='Say "Hello" to the world'></div>`)
  })

  test("allows single quotes when value contains double quotes and ERB content", () => {
    expectNoOffenses(`<div class='Say "Hello" to <%= name %>'></div>`)
  })

  test("still fails for single quotes when value has no double quotes", () => {
    expectWarning('Attribute `id` uses single quotes. Prefer double quotes for HTML attribute values: `id="hello"`.')
    expectWarning('Attribute `class` uses single quotes. Prefer double quotes for HTML attribute values: `class="world"`.')
    assertOffenses(`<div id='hello' class='world'></div>`)
  })
})
