import { describe, test } from "vitest"
import { HTMLNoEmptyAttributesRule } from "../../src/rules/html-no-empty-attributes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoEmptyAttributesRule)

describe("html-no-empty-attributes", () => {
  test("passes for attributes with meaningful values", () => {
    expectNoOffenses(`<div id="header" class="container" name="main"></div>`)
  })

  test("fails for empty id attribute", () => {
    expectWarning('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div id=""></div>`)
  })

  test("fails for empty class attribute", () => {
    expectWarning('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div class=""></div>`)
  })

  test("fails for empty name attribute", () => {
    expectWarning('Attribute `name` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<input name="">`)
  })

  test("fails for empty for attribute", () => {
    expectWarning('Attribute `for` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<label for="">Label</label>`)
  })

  test("fails for empty src attribute", () => {
    expectWarning('Attribute `src` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<img src="" alt="Image">`)
  })

  test("fails for empty href attribute", () => {
    expectWarning('Attribute `href` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<a href="">Link</a>`)
  })

  test("fails for empty title attribute", () => {
    expectWarning('Attribute `title` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<a href="https://example.com" title="">Link</a>`)
  })

  test("fails for empty data attribute", () => {
    expectWarning('Attribute `data` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div data=""></div>`)
  })

  test("fails for data-* attributes with empty values", () => {
    expectWarning('Data attribute `data-value` should not have an empty value. Either provide a meaningful value or use `data-value` instead of `data-value=""`.')
    expectWarning('Data attribute `data-config` should not have an empty value. Either provide a meaningful value or use `data-config` instead of `data-config=""`.')
    assertOffenses(`<div data-value="" data-config=""></div>`)
  })

  test("fails for aria-* attributes with empty values", () => {
    expectWarning('Attribute `aria-label` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expectWarning('Attribute `aria-describedby` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<button aria-label="" aria-describedby="">Button</button>`)
  })

  test("fails for role attribute with empty value", () => {
    expectWarning('Attribute `role` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div role=""></div>`)
  })

  test("fails for multiple empty attributes", () => {
    expectWarning('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expectWarning('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expectWarning('Data attribute `data-test` should not have an empty value. Either provide a meaningful value or use `data-test` instead of `data-test=""`.')
    assertOffenses(`<div id="" class="" data-test=""></div>`)
  })

  test("fails for whitespace-only values", () => {
    expectWarning('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expectWarning('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div id="   " class=""></div>`)
  })

  test("passes for attributes with ERB output", () => {
    expectNoOffenses(`<div id="<%= element_id %>" class="<%= css_classes %>"></div>`)
  })

  test("passes for mixed static and ERB content", () => {
    expectNoOffenses(`<div class="base <%= additional_classes %>"></div>`)
  })

  test("fails for dynamic data-* attribute name with empty value", () => {
    expectWarning('Data attribute `data-<%= key %>` should not have an empty value. Either provide a meaningful value or use `data-<%= key %>` instead of `data-<%= key %>=""`.')
    assertOffenses(`<div data-<%= key %>=""></div>`)
  })

  test("fails for dynamic data-* composite name with empty value", () => {
    expectWarning('Data attribute `data-<%= key %>-id` should not have an empty value. Either provide a meaningful value or use `data-<%= key %>-id` instead of `data-<%= key %>-id=""`.')
    assertOffenses(`<div data-<%= key %>-id=""></div>`)
  })

  test("fails for dynamic data-* attribute name with whitespace-only value", () => {
    expectWarning('Data attribute `data-<%= key %>` should not have an empty value. Either provide a meaningful value or use `data-<%= key %>` instead of `data-<%= key %>="   "`.')
    assertOffenses(`<div data-<%= key %>="   "></div>`)
  })

  test("fails for dynamic aria-* attribute name with empty value", () => {
    expectWarning('Attribute `aria-<%= prop %>` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<button aria-<%= prop %>=""></button>`)
  })

  test("passes for dynamic attribute name with ERB value", () => {
    expectNoOffenses(`<div data-<%= key %>="<%= value %>"></div>`)
  })

  test("fails for attribute with ERB that doesn't output anything", () => {
    expectWarning('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    assertOffenses(`<div class="<% value %>"></div>`)
  })

  test("passes for attribute with static value and ERB that doesn't output anything", () => {
    expectNoOffenses(`<div class="something.<% value %>"></div>`)
  })

  test("passes for data-* attributes without explicit values", () => {
    expectNoOffenses(`<div data-test data-value data-config></div>`)
  })

  test("fails for data-* attributes with explicit empty string values", () => {
    expectWarning('Data attribute `data-test` should not have an empty value. Either provide a meaningful value or use `data-test` instead of `data-test=""`.')
    expectWarning('Data attribute `data-value` should not have an empty value. Either provide a meaningful value or use `data-value` instead of `data-value=""`.')
    assertOffenses(`<div data-test="" data-value=""></div>`)
  })

  test("mixed data attributes: passes for implicit values, fails for explicit empty values", () => {
    expectWarning('Data attribute `data-config` should not have an empty value. Either provide a meaningful value or use `data-config` instead of `data-config=""`.')
    assertOffenses(`<div data-test data-config="" data-value></div>`)
  })

  test("passes for data-turbo-permanent without value", () => {
    expectNoOffenses(`<div data-turbo-permanent>Content</div>`)
  })

  test("fails for data-turbo-permanent with explicit empty value", () => {
    expectWarning('Data attribute `data-turbo-permanent` should not have an empty value. Either provide a meaningful value or use `data-turbo-permanent` instead of `data-turbo-permanent=""`.')
    assertOffenses(`<div data-turbo-permanent="">Content</div>`)
  })
})
