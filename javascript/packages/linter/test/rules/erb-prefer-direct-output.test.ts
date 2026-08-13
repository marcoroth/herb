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
      'Avoid outputting string literal `"Title"`. Use `Title` instead.',
    )

    assertOffenses('<%= "Title" %>')
  })

  test("fails for single-quoted string literal", () => {
    expectError(
      "Avoid outputting string literal `'Title'`. Use `Title` instead.",
    )

    assertOffenses("<%= 'Title' %>")
  })

  test("fails for empty string literal", () => {
    expectError(
      'Avoid outputting string literal `""`. Remove the empty output tag instead.',
    )

    assertOffenses('<%= "" %>')
  })

  test("fails for interpolated string with single expression", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use `<%= key %>` instead.',
    )

    assertOffenses('<%= "#{key}" %>')
  })

  test("fails for interpolated string with multiple expressions", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key} (#{participants.size})"`. Use `<%= key %> (<%= participants.size %>)` instead.',
    )

    assertOffenses('<%= "#{key} (#{participants.size})" %>')
  })

  test("fails for interpolated string with text and expression", () => {
    expectError(
      'Avoid outputting interpolated string `"Hello #{name}"`. Use `Hello <%= name %>` instead.',
    )

    assertOffenses('<%= "Hello #{name}" %>')
  })

  test("shows the exact rewrite for trailing text", () => {
    expectError(
      'Avoid outputting interpolated string `"#{i + 1}."`. Use `<%= i + 1 %>.` instead.',
    )

    assertOffenses('<%= "#{i + 1}." %>')
  })

  test("fails for raw output with string literal", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Use `Title` instead.',
    )

    assertOffenses('<%== "Title" %>')
  })

  test("fails for raw output with interpolated string", () => {
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use `<%== key %>` instead.',
    )

    assertOffenses('<%== "#{key}" %>')
  })

  test("fails for string literal inside element", () => {
    expectError(
      'Avoid outputting string literal `"Title"`. Use `Title` instead.',
    )

    assertOffenses('<h1><%= "Title" %></h1>')
  })

  test("fails for string literal in attribute value", () => {
    expectError(
      'Avoid outputting string literal `"active"`. Use `active` instead.',
    )

    assertOffenses('<div class="<%= "active" %>">content</div>')
  })

  test("reports multiple offenses", () => {
    expectError(
      'Avoid outputting string literal `"Hello"`. Use `Hello` instead.',
    )
    expectError(
      'Avoid outputting string literal `"World"`. Use `World` instead.',
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
      'Avoid outputting string literal `"Title"`. Use `Title` instead.',
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
      'Avoid outputting string literal `"Title"`. Use `Title` instead.',
    )
    expectError(
      'Avoid outputting interpolated string `"#{key}"`. Use `<%= key %>` instead.',
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
      'Avoid outputting string literal `"Admin"`. Use `Admin` instead.',
    )

    assertOffenses(dedent`
      <% if user.admin? %>
        <%= "Admin" %>
      <% end %>
    `)
  })

  test("passes for string literal containing `<`", () => {
    expectNoOffenses('<p><%= "a <b> c" %></p>')
  })

  test("passes for string literal containing `&`", () => {
    expectNoOffenses('<p><%= "a & b" %></p>')
  })

  test("passes for interpolated string containing `<`", () => {
    expectNoOffenses('<p><%= "#{a} <request body> -- #{b}" %></p>')
  })

  test("passes for interpolated string containing `&`", () => {
    expectNoOffenses('<p><%= "#{a} & #{b}" %></p>')
  })

  test("passes for string literal in an unquoted attribute value", () => {
    expectNoOffenses('<div id=<%= "foo" %>>y</div>')
  })

  test("passes for interpolated string in an unquoted attribute value", () => {
    expectNoOffenses('<div id=<%= "#{a}_#{b}" %>>y</div>')
  })

  test("passes for string literal containing the enclosing double quote", () => {
    expectNoOffenses(`<div title="<%= "say \\"hi\\"" %>">y</div>`)
  })

  test("passes for string literal containing the enclosing single quote", () => {
    expectNoOffenses(`<div title='<%= "it\\'s" %>'>y</div>`)
  })

  test("fails for string literal containing a quote the enclosing attribute does not use", () => {
    expectError(
      `Avoid outputting string literal \`"it's"\`. Use \`it's\` instead.`,
    )

    assertOffenses(`<div title="<%= "it's" %>">y</div>`)
  })

  test("fails for string literal containing `>`", () => {
    expectError(
      'Avoid outputting string literal `"a > b"`. Use `a > b` instead.',
    )

    assertOffenses('<p><%= "a > b" %></p>')
  })

  test("fails for interpolated string in a quoted attribute value", () => {
    expectError(
      'Avoid outputting interpolated string `"#{a}_#{b}"`. Use `<%= a %>_<%= b %>` instead.',
    )

    assertOffenses('<div id="<%= "#{a}_#{b}" %>">y</div>')
  })
})
