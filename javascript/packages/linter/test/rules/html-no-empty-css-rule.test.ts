import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoEmptyCSSRuleRule } from "../../src/rules/html-no-empty-css-rule.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoEmptyCSSRuleRule)

describe("html-no-empty-css-rule", () => {
  test("passes when every rule has declarations", () => {
    expectNoOffenses(dedent`
      <style>
        .card { color: red; }
      </style>
    `)
  })

  test("passes with no style block", () => {
    expectNoOffenses("<div>Hi</div>")
  })

  test("passes for a rule holding a comment", () => {
    expectNoOffenses(dedent`
      <style>
        .card { /* todo */ }
      </style>
    `)
  })

  test("flags an empty rule", () => {
    expectError("The `.card` rule in this `<style>` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style>
        .card { }
      </style>
    `)
  })

  test("flags an empty rule in a scoped block", () => {
    expectError("The `.card` rule in this `<style>` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .card { }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags each empty rule", () => {
    expectError("The `.a` rule in this `<style>` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.", [2, 2])
    expectError("The `.b` rule in this `<style>` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.", [4, 2])

    assertOffenses(dedent`
      <style>
        .a { }
        .used { color: red; }
        .b {
        }
      </style>
    `)
  })

  test("passes when the rule body is built with ERB", () => {
    expectNoOffenses(dedent`
      <style>
        .card {
          <% if dark %>color: white;<% end %>
        }
      </style>
    `)
  })

  test("spans the whole rule, including its braces", () => {
    expectError("The `.card` rule in this `<style>` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.", { line: 2, column: 2, endLine: 3, endColumn: 3 })

    assertOffenses(dedent`
      <style>
        .card {
        }
      </style>
    `)
  })
})
