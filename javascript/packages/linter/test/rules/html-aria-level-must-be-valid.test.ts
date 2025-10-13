import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLAriaLevelMustBeValidRule } from "../../src/rules/html-aria-level-must-be-valid.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAriaLevelMustBeValidRule)

describe("HTMLAriaLevelMustBeValidRule", () => {
  test("allows valid aria-level values 1-6", () => {
    expectNoOffenses(dedent`
      <div role="heading" aria-level="1">Main</div>
      <div role="heading" aria-level="2">Section</div>
      <div role="heading" aria-level="3">Subsection</div>
      <div role="heading" aria-level="4">Sub-subsection</div>
      <div role="heading" aria-level="5">Deep heading</div>
      <div role="heading" aria-level="6">Footnote</div>
    `)
  })

  test("allows elements without aria-level attribute", () => {
    expectNoOffenses(dedent`
      <div role="heading">No aria-level</div>
      <h1>Regular heading</h1>
      <div>Regular div</div>
    `)
  })

  test("flags negative aria-level values", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `-1`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="-1">Negative</div>
    `)
  })

  test("flags zero aria-level value", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `0`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="0">Main</div>
    `)
  })

  test("flags aria-level values greater than 6", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `7`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="7">Too deep</div>
    `)
  })

  test("flags non-numeric aria-level values", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `foo`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="foo">Invalid</div>
    `)
  })

  test("flags multiple invalid aria-level values", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `-1`.')
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `0`.')
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `7`.')
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `foo`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="-1">Negative</div>
      <div role="heading" aria-level="0">Zero</div>
      <div role="heading" aria-level="7">Too deep</div>
      <div role="heading" aria-level="foo">Invalid</div>
    `)
  })

  test("handles floating point numbers", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `1.5`.')

    assertOffenses(dedent`
      <div role="heading" aria-level="1.5">Float</div>
    `)
  })

  test("flags whitespace in aria-level values", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got ` 2 `.')

    assertOffenses(dedent`
      <div role="heading" aria-level=" 2 ">Whitespace</div>
    `)
  })

  test("allows ERB expressions in aria-level values", () => {
    expectNoOffenses(dedent`
      <div aria-level="<%= @level %>">Dynamic level</div>
    `)
  })

  test("allows mixed ERB expressions with no output in aria-level values", () => {
    expectNoOffenses(dedent`
      <div aria-level="1<% @level %>">Dynamic level</div>
      <div aria-level="<% @level %>2">Dynamic level</div>
      <div aria-level="<% @level %>3<% @level %>">Dynamic level</div>
    `)
  })

  test("disallows mixed ERB expressions with no output in aria-level values", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `-1`.')

    assertOffenses(dedent`
      <div aria-level="-1<% @level %>">Dynamic level</div>
    `)
  })

  test("disallows mixed ERB expressions with valid static value and dynamic ERB output", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got `1` and the ERB expression `<%= @level %>`.')

    assertOffenses(dedent`
      <div aria-level="1<%= @level %>">Dynamic level</div>
    `)
  })

  test.todo("allows mixed ERB expressions in aria-level values if both branches are valid", () => {
    expectNoOffenses(dedent`
      <div aria-level="<% if valid? %>1<% else %>2<% end %>">Dynamic level</div>
    `)
  })

  test.todo("flags mixed ERB expressions in aria-level values if one branch is valid", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, at least one branch has an invlid value: `-1`.')

    assertOffenses(dedent`
      <div aria-level="<% if valid? %>1<% else %>-1<% end %>">Dynamic level</div>
    `)
  })

  test("flags empty aria-level attribute", () => {
    expectError('The `aria-level` attribute must be an integer between 1 and 6, got an empty value.')

    assertOffenses(dedent`
      <div role="heading" aria-level="">Empty value</div>
    `)
  })
})
