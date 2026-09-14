import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateDirectiveSyntaxRule } from "../../src/rules/herb-state-directive-syntax.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateDirectiveSyntaxRule)

describe("HerbStateDirectiveSyntaxRule", () => {
  test("allows the canonical spelling", () => {
    expectNoOffenses(`<%# herb:state (open: false) %>`)
  })

  test("allows several states in the canonical spelling", () => {
    expectNoOffenses(`<%# herb:state (open: false, count: 0, title: "") %>`)
  })

  test("allows an indented directive inside a block", () => {
    expectNoOffenses(dedent`
      <% items.each do |item| %>
        <%# herb:state (open: false) %>
      <% end %>
    `)
  })

  test("allows an empty signature", () => {
    expectNoOffenses(`<%# herb:state () %>`)
  })

  test("ignores an ordinary ERB comment", () => {
    expectNoOffenses(`<%# just a comment %>`)
  })

  test("ignores a strict locals declaration", () => {
    expectNoOffenses(`<%# locals: (message:) %>`)
  })

  test("ignores other Herb directives", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:disable html-tag-name-lowercase %>
      <%# herb:formatter ignore %>
    `)
  })

  test("flags a leading trim marker", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%#- herb:state (open: false) -%>`)
  })

  test("flags a trailing trim marker", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%# herb:state (open: false) -%>`)
  })

  test("flags a missing space after the comment opening", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%#herb:state (open: false) %>`)
  })

  test("flags extra whitespace before the signature", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%# herb:state  (open: false) %>`)
  })

  test("flags a missing space before the comment closing", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%# herb:state (open: false)%>`)
  })

  test("flags a tab where a space belongs", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%#\therb:state (open: false) %>`)
  })

  test("flags a signature spread across several lines and suggests one line", () => {
    expectError("The `herb:state` directive has to be spelled `<%# herb:state (open: false, count: 0) %>`. Write it on one line as `<%# herb:state (...) %>`, with a single space in each gap, so the states it declares are read the same way everywhere.")
    assertOffenses(`<%# herb:state (\n  open: false,\n  count: 0\n) %>`)
  })

  test("keeps whitespace inside a string default when suggesting the canonical form", () => {
    expectError(`The \`herb:state\` directive has to be spelled \`<%# herb:state (title: "a  b") %>\`. Write it on one line as \`<%# herb:state (...) %>\`, with a single space in each gap, so the states it declares are read the same way everywhere.`)
    assertOffenses(`<%# herb:state  (title: "a  b") %>`)
  })

  test("does not flag a directive without parentheses, which is a declaration problem", () => {
    expectNoOffenses(`<%# herb:state open: false %>`)
  })
})
