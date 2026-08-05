import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBPreferDirectOutputRule } from "../../src/rules/erb-prefer-direct-output.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBPreferDirectOutputRule)

describe("erb-prefer-direct-output", () => {
  test("passes for variable output", () => {
    expectNoOffenses('<%= variable %>')
  })

  test("passes for method call output", () => {
    expectNoOffenses('<%= some_method %>')
  })

  test("passes for method chain output", () => {
    expectNoOffenses('<%= object.method %>')
  })

  test("passes for method call with string argument", () => {
    expectNoOffenses('<%= t("hello") %>')
  })

  test("passes for integer literal output", () => {
    expectNoOffenses('<%= 42 %>')
  })

  test("passes for boolean literal output", () => {
    expectNoOffenses('<%= true %>')
  })

  test("passes for symbol literal output", () => {
    expectNoOffenses('<%= :symbol %>')
  })

  test("passes for plain text content", () => {
    expectNoOffenses('Title')
  })

  test("passes for plain text inside element", () => {
    expectNoOffenses('<div>Title</div>')
  })

  test("passes for silent ERB tag with string", () => {
    expectNoOffenses('<% "Title" %>')
  })

  test("passes for ERB output with concatenation", () => {
    expectNoOffenses('<%= "Hello" + " " + "World" %>')
  })

  test("passes for ERB output with ternary", () => {
    expectNoOffenses('<%= condition ? "yes" : "no" %>')
  })

  test("passes for ERB output with method on string", () => {
    expectNoOffenses('<%= "Title".upcase %>')
  })

  test("passes for ERB output with html_safe", () => {
    expectNoOffenses('<%= "Title".html_safe %>')
  })

  test("passes for ERB output with freeze", () => {
    expectNoOffenses('<%= "Title".freeze %>')
  })

  test("passes for empty ERB output", () => {
    expectNoOffenses('<%=  %>')
  })

  test("passes for ERB output in attribute", () => {
    expectNoOffenses('<div class="<%= css_class %>">content</div>')
  })

  test("passes for ERB output in complex template", () => {
    expectNoOffenses(dedent`
      <div class="container">
        <% if user.admin? %>
          <span class="badge"><%= user.name %></span>
        <% end %>
      </div>
    `)
  })

  test("fails for double-quoted string literal", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses('<%= "Title" %>')
  })

  test("fails for single-quoted string literal", () => {
    expectError(
      "Avoid outputting string literal `'Title'`. Write the text directly without wrapping it in an ERB output tag.",
    )

    assertOffenses("<%= 'Title' %>")
  })

  test("fails for empty string literal", () => {
    expectError(
      'Avoid outputting string literal `""`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses('<%= "" %>')
  })

  test("fails for interpolated string with single expression", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use separate `<%= %>` tags for each dynamic value instead.',
    )

    assertOffenses('<%= "#{key}" %>')
  })

  test("fails for interpolated string with multiple expressions", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key} (#{participants.size})"`. Use separate `<%= %>` tags for each dynamic value instead.',
    )

    assertOffenses('<%= "#{key} (#{participants.size})" %>')
  })

  test("fails for interpolated string with text and expression", () => {
    expectError(
      'Avoid outputting interpolated string `"Hello #{name}"`. Use separate `<%= %>` tags for each dynamic value instead.',
    )

    assertOffenses('<%= "Hello #{name}" %>')
  })

  test("fails for raw output with string literal", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses('<%== "Title" %>')
  })

  test("fails for raw output with interpolated string", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use separate `<%= %>` tags for each dynamic value instead.',
    )

    assertOffenses('<%== "#{key}" %>')
  })

  test("fails for string literal inside element", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses('<h1><%= "Title" %></h1>')
  })

  test("fails for string literal in attribute value", () => {
    expectError(
      'Avoid outputting string literal `"active"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses('<div class="<%= "active" %>">content</div>')
  })

  test("reports multiple offenses", () => {
    expectError(
      'Avoid outputting string literal `"Hello"`. Write the text directly without wrapping it in an ERB output tag.',
    )
    expectError(
      'Avoid outputting string literal `"World"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses(dedent`
      <div>
        <%= "Hello" %>
        <%= "World" %>
      </div>
    `)
  })

  test("reports offense at correct location", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Write the text directly without wrapping it in an ERB output tag.',
      [2, 6],
    )

    assertOffenses(dedent`
      <div>
        <%= "Title" %>
      </div>
    `)
  })

  test("reports mixed string and interpolated string offenses", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Write the text directly without wrapping it in an ERB output tag.',
    )
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use separate `<%= %>` tags for each dynamic value instead.',
    )

    assertOffenses(dedent`
      <div>
        <%= "Title" %>
        <%= "#{key}" %>
      </div>
    `)
  })

  test("fails for string literal inside control flow", () => {
    expectError(
      'Avoid outputting string literal `"Admin"`. Write the text directly without wrapping it in an ERB output tag.',
    )

    assertOffenses(dedent`
      <% if user.admin? %>
        <%= "Admin" %>
      <% end %>
    `)
  })
})
