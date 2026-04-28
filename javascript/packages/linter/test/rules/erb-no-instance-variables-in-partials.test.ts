import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBNoInstanceVariablesInPartialsRule } from "../../src/rules/erb-no-instance-variables-in-partials.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoInstanceVariablesInPartialsRule)

describe("ERBNoInstanceVariablesInPartialsRule", () => {
  test("allows local variables in partials", () => {
    expectNoOffenses(dedent`
      <div>
        <%= post.title %>
      </div>
    `, { fileName: "_card.html.erb" })
  })

  test("allows local variables passed to partials", () => {
    expectNoOffenses(dedent`
      <div>
        <%= user.name %>
        <%= title %>
      </div>
    `, { fileName: "_user_card.html.erb" })
  })

  test("flags instance variables in partials", () => {
    expectError("Avoid using instance variables in partials. Pass `@post` as a local variable instead.", [2, 6])

    assertOffenses(dedent`
      <div>
        <%= @post.title %>
      </div>
    `, { fileName: "_card.html.erb" })
  })

  test("flags multiple instance variables in partials", () => {
    expectError("Avoid using instance variables in partials. Pass `@post` as a local variable instead.", [2, 6])
    expectError("Avoid using instance variables in partials. Pass `@user` as a local variable instead.", [3, 6])

    assertOffenses(dedent`
      <div>
        <%= @post.title %>
        <%= @user.name %>
      </div>
    `, { fileName: "_card.html.erb" })
  })

  test("flags instance variables in silent ERB tags in partials", () => {
    expectError("Avoid using instance variables in partials. Pass `@posts` as a local variable instead.", [1, 3])

    assertOffenses(dedent`
      <% @posts.each do |post| %>
        <div><%= post.title %></div>
      <% end %>
    `, { fileName: "_list.html.erb" })
  })

  test("does not flag instance variables in non-partial files", () => {
    expectNoOffenses(dedent`
      <div>
        <%= @post.title %>
      </div>
    `, { fileName: "show.html.erb" })
  })

  test("does not flag instance variables in layout files", () => {
    expectNoOffenses(dedent`
      <!DOCTYPE html>
      <html>
        <body><%= @content %></body>
      </html>
    `, { fileName: "application.html.erb" })
  })

  test("does not flag when filename is not provided", () => {
    expectNoOffenses(dedent`
      <div>
        <%= @post.title %>
      </div>
    `, { fileName: undefined })
  })

  test("flags instance variables in deeply nested partials path", () => {
    expectError("Avoid using instance variables in partials. Pass `@user` as a local variable instead.", [1, 4])

    assertOffenses(dedent`
      <%= @user.name %>
    `, { fileName: "app/views/users/_profile.html.erb" })
  })

  test("does not flag class variables", () => {
    expectNoOffenses(dedent`
      <%= @@counter %>
    `, { fileName: "_card.html.erb" })
  })

  test("does not flag email addresses in text", () => {
    expectNoOffenses(dedent`
      <p>Contact us</p>
    `, { fileName: "_footer.html.erb" })
  })

  test("flags instance variable writes in partials", () => {
    expectError("Avoid setting instance variables in partials. Use a local variable instead of `@record`.", [1, 3])

    assertOffenses(dedent`
      <% @record = "hello" %>
    `, { fileName: "_form.html.erb" })
  })

  test("flags instance variables in if conditions", () => {
    expectError("Avoid using instance variables in partials. Pass `@show` as a local variable instead.", [1, 6])

    assertOffenses(dedent`
      <% if @show %>
        <p>Visible</p>
      <% end %>
    `, { fileName: "_toggle.html.erb" })
  })
})
