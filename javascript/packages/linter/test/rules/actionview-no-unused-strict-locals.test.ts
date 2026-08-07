import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoUnusedStrictLocalsRule } from "../../src/rules/actionview-no-unused-strict-locals.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoUnusedStrictLocalsRule)

describe("actionview-no-unused-strict-locals", () => {
  test("flags a declared local that is never used", () => {
    expectError("Strict local `age` is never used in this partial. Callers have to pass `age:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= name %>
    `)
  })

  test("reports the offense on the local itself", () => {
    expectError("Strict local `age` is never used in this partial. Callers have to pass `age:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.", [1, 20])

    assertOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= name %>
    `)
  })

  test("flags every unused local", () => {
    expectError("Strict local `name` is never used in this partial. Callers have to pass `name:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")
    expectError("Strict local `age` is never used in this partial. Callers have to pass `age:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:, age:) %>

      <p>Hello</p>
    `)
  })

  test("flags an unused local with a default value", () => {
    expectError("Strict local `size` is never used in this partial. Callers can pass `size:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:, size: "large") %>

      <%= name %>
    `)
  })

  test("does not flag locals that are all used", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= name %> is <%= age %>
    `)
  })

  test("does not flag a local used in a silent tag", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <% if user.admin? %>
        <p>Admin</p>
      <% end %>
    `)
  })

  test("does not flag a local used inside a block", () => {
    expectNoOffenses(dedent`
      <%# locals: (users:) %>

      <% users.each do |user| %>
        <%= user.name %>
      <% end %>
    `)
  })

  test("does not flag a local used in an attribute value", () => {
    expectNoOffenses(dedent`
      <%# locals: (classes:) %>

      <div class="<%= classes %>"></div>
    `)
  })

  test("does not flag a local used as an argument to a helper", () => {
    expectNoOffenses(dedent`
      <%# locals: (path:) %>

      <%= link_to "Home", path %>
    `)
  })

  test("does not flag a local passed along in a render `locals:` hash", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= render "row", locals: { user: user } %>
    `)
  })

  test("does not flag a local passed along in a `render partial:` call", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, size:) %>

      <%= render partial: "row", locals: { user: user, size: size } %>
    `)
  })

  test("does not flag a local passed along with the shorthand hash syntax", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= render "row", locals: { user: } %>
    `)
  })

  test("does not flag a local passed along as a render keyword", () => {
    expectNoOffenses(dedent`
      <%# locals: (users:) %>

      <%= render partial: "row", collection: users %>
    `)
  })

  test("flags a local that is not passed along to the nested render", () => {
    expectError("Strict local `size` is never used in this partial. Callers have to pass `size:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (user:, size:) %>

      <%= render "row", locals: { user: user } %>
    `)
  })

  test("does not flag a local used in string interpolation", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:) %>

      <%= "Hello #{name}" %>
    `)
  })

  test("does not treat a String literal as a usage", () => {
    expectError("Strict local `name` is never used in this partial. Callers have to pass `name:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:) %>

      <%= "name" %>
    `)
  })

  test("does not flag a local used in another local's default value", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, greeting: "Hello #{name}") %>

      <%= greeting %>
    `)
  })

  test("does not flag a local read through local_assigns", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:) %>

      <%= local_assigns[:name] %>
    `)
  })

  test("does not flag a local fetched from local_assigns", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:) %>

      <%= local_assigns.fetch(:name, "Anonymous") %>
    `)
  })

  test("does not flag any local when local_assigns is used as a whole", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= render "row", **local_assigns %>
    `)
  })

  test("does not flag locals prefixed with an underscore", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, _age:) %>

      <%= name %>
    `)
  })

  test("does not flag a keyword rest parameter", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, **options) %>

      <%= name %>
    `)
  })

  test("does not treat HTML text as a usage", () => {
    expectError("Strict local `name` is never used in this partial. Callers have to pass `name:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:) %>

      <p>name</p>
    `)
  })

  test("does not treat an ERB comment as a usage", () => {
    expectError("Strict local `name` is never used in this partial. Callers have to pass `name:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:) %>

      <%# TODO: render name %>
    `)
  })

  test("does not treat the declaration itself as a usage", () => {
    expectError("Strict local `name` is never used in this partial. Callers have to pass `name:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(`<%# locals: (name:) %>`)
  })

  test("does not flag templates without a strict locals declaration", () => {
    expectNoOffenses(dedent`
      <div>
        <%= name %>
      </div>
    `)
  })

  test("does not flag an empty strict locals declaration", () => {
    expectNoOffenses(dedent`
      <%# locals: () %>

      <p>Hello</p>
    `)
  })

  test("does not run for non-partial files", () => {
    expectNoOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= name %>
    `, { fileName: "show.html.erb" })
  })

  test("runs for partial files", () => {
    expectError("Strict local `age` is never used in this partial. Callers have to pass `age:` for a value the template never renders. Remove it from the `locals:` declaration and from the call sites.")

    assertOffenses(dedent`
      <%# locals: (name:, age:) %>

      <%= name %>
    `, { fileName: "app/views/users/_card.html.erb" })
  })
})
