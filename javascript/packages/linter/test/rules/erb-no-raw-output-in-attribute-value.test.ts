import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoRawOutputInAttributeValueRule } from "../../src/rules/erb-no-raw-output-in-attribute-value.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoRawOutputInAttributeValueRule)

const MESSAGE = "Avoid `<%==` in attribute values. Use `<%= %>` instead to ensure proper HTML escaping."

describe("ERBNoRawOutputInAttributeValueRule", () => {
  test("raw output tag in attribute value is not allowed", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <div class="<%== user_input %>"></div>
    `)
  })

  test("raw output tag in non-JS attribute is not allowed", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <a href="<%== unsafe %>">Link</a>
    `)
  })

  test("raw output tag even with to_json in JS attribute is not allowed", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <a onclick="method(<%== unsafe.to_json %>)"></a>
    `)
  })

  test("raw output tag in multiple attribute values", () => {
    expectError(MESSAGE)
    expectError(MESSAGE)

    assertOffenses(dedent`
      <div class="<%== class_name %>" id="<%== element_id %>"></div>
    `)
  })

  test("regular ERB output in attribute value is allowed", () => {
    expectNoOffenses(dedent`
      <div class="<%= user_input %>"></div>
    `)
  })

  test("<%== in script tag is not flagged by this rule", () => {
    expectNoOffenses(dedent`
      <script>var myData = <%== foo.to_json %>;</script>
    `)
  })

  test("static attribute value is allowed", () => {
    expectNoOffenses(dedent`
      <div class="container"></div>
    `)
  })
})
