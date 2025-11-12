import dedent from "dedent"
import { describe, test } from "vitest"
import { ParserNoErrorsRule } from "../../src/rules/parser-no-errors.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ParserNoErrorsRule)

describe("ParserNoErrorsRule", () => {
  test("should not report errors for valid HTML", () => {
    expectNoOffenses(dedent`
      <h1>Hello World</h1>
      <p>This is a paragraph.</p>
      <div>
        <%= user.name %>
      </div>
    `)
  })

  test("should report errors for mismatched tag names", () => {
    expectError("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Opening tag `<h3>` at (3:1) doesn't have a matching closing tag `</h3>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    assertOffenses(dedent`
      <h2>
        Some content
      <h3>
    `)
  })

  test("should report errors for unclosed elements", () => {
    expectError("Opening tag `<p>` at (2:3) doesn't have a matching closing tag `</p>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    assertOffenses(dedent`
      <div>
        <p>Some content
      </div>
    `)
  })

  test("should report errors for void elements with closing tags", () => {
    expectError("`img` is a void element and should not be used as a closing tag. Use `<img>` or `<img />` instead of `</img>`. (`VOID_ELEMENT_CLOSING_TAG_ERROR`)")
    assertOffenses(`<img src="test.jpg" alt="test"></img>`)
  })

  test("should report errors for missing opening tags", () => {
    expectError("Found closing tag `</div>` at (2:2) without a matching opening tag in the same scope. (`MISSING_OPENING_TAG_ERROR`)")
    assertOffenses(dedent`
      Some content
      </div>
    `)
  })

  test("should report errors for mismatched quotes in attributes", () => {
    expectError("Found `TOKEN_EOF` when expecting `TOKEN_HTML_TAG_SELF_CLOSE` at (1:24). (`UNEXPECTED_TOKEN_ERROR`)")
    expectError("Found `TOKEN_EOF` when expecting `TOKEN_QUOTE` at (1:24). (`UNEXPECTED_TOKEN_ERROR`)")
    expectError("String opened with \" but closed with  at (1:24). (`QUOTES_MISMATCH_ERROR`)")
    assertOffenses(`<div class="test'></div>`)
  })

  test("should report Ruby parse errors in ERB tags", () => {
    expectError("expect_expression_after_operator: unexpected end-of-input; expected an expression after the operator (`RUBY_PARSE_ERROR`)")
    expectError("unexpected_token_close_context: unexpected end-of-input, assuming it is closing the parent top level context (`RUBY_PARSE_ERROR`)")
    assertOffenses(`<%= 1 + %>`)
  })

  test("should report multiple parser errors", () => {
    expectError("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Opening tag `<p>` at (2:3) doesn't have a matching closing tag `</p>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Found closing tag `</h3>` at (3:2) without a matching opening tag in the same scope. (`MISSING_OPENING_TAG_ERROR`)")
    expectError("Found closing tag `</div>` at (4:2) without a matching opening tag in the same scope. (`MISSING_OPENING_TAG_ERROR`)")
    assertOffenses(dedent`
      <h2>
        <p>Unclosed paragraph
      </h3>
      </div>
    `)
  })

  test("should work alongside other linting rules", () => {
    expectError("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Found closing tag `</h3>` at (3:2) without a matching opening tag in the same scope. (`MISSING_OPENING_TAG_ERROR`)")
    assertOffenses(dedent`
      <h2>
        <% %>
      </h3>
    `)
  })

  test("should include error location information", () => {
    expectError("Opening tag `<h2>` at (2:3) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Found closing tag `</h3>` at (2:15) without a matching opening tag in the same scope. (`MISSING_OPENING_TAG_ERROR`)")
    assertOffenses(dedent`
      <div>
        <h2>Content</h3>
      </div>
    `)
  })

  test("should handle the specific case from issue #359", () => {
    expectError("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    expectError("Opening tag `<h2>` at (1:25) doesn't have a matching closing tag `</h2>` in the same scope. (`MISSING_CLOSING_TAG_ERROR`)")
    assertOffenses(dedent`
      <h2>Some heading content<h2>
    `)
  })

  test("html element ending with boolean attribute followed by ERB tag", () => {
    expectNoOffenses(dedent`
      <link crossorigin>
      <%= hello %>
    `)
  })
})
