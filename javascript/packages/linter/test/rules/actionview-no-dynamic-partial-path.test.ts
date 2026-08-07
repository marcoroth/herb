import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoDynamicPartialPathRule } from "../../src/rules/actionview-no-dynamic-partial-path.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoDynamicPartialPathRule)

const ACTION = 'Use a literal name, or branch between literal names, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them.'
const INTERPOLATED = `The partial name is interpolated, so it is only known at runtime. ${ACTION}`
const COMPUTED = `The partial name comes from a variable or method call, so it is only known at runtime. ${ACTION}`

describe("actionview-no-dynamic-partial-path", () => {
  test("flags an interpolated path in the keyword form", () => {
    expectInfo(INTERPOLATED)

    assertOffenses('<%= render partial: "users/#{user.role}" %>')
  })

  test("flags an interpolated path in the shorthand form", () => {
    expectInfo(INTERPOLATED)

    assertOffenses('<%= render "components/#{name}" %>')
  })

  test("reports the offense on the path expression", () => {
    expectInfo(INTERPOLATED, [1, 20])

    assertOffenses('<%= render partial: "users/#{user.role}" %>')
  })

  test("flags a variable used as an explicit partial path", () => {
    expectInfo(COMPUTED)

    assertOffenses(`<%= render partial: partial_name %>`)
  })

  test("flags an instance variable used as an explicit partial path", () => {
    expectInfo(COMPUTED)

    assertOffenses(`<%= render partial: @partial %>`)
  })

  test("flags a concatenated path", () => {
    expectInfo(COMPUTED)

    assertOffenses(`<%= render partial: "users/" + kind %>`)
  })

  test("flags a dynamic path inside markup", () => {
    expectInfo(INTERPOLATED)

    assertOffenses(dedent`
      <div class="row">
        <%= render partial: "users/#{user.role}" %>
      </div>
    `)
  })

  test("does not flag a literal path in the shorthand form", () => {
    expectNoOffenses(`<%= render "users/card" %>`)
  })

  test("does not flag a literal path in the keyword form", () => {
    expectNoOffenses(`<%= render partial: "users/card" %>`)
  })

  test("does not flag a literal path with locals", () => {
    expectNoOffenses(`<%= render partial: "users/card", locals: { user: @user } %>`)
  })

  test("does not flag a ternary between literal paths", () => {
    expectNoOffenses(`<%= render partial: current_user.admin? ? "admin/header" : "user/header" %>`)
  })

  test("does not flag a nested ternary between literal paths", () => {
    expectNoOffenses(`<%= render partial: a? ? "one" : b? ? "two" : "three" %>`)
  })

  test("does not flag an object render", () => {
    expectNoOffenses(`<%= render @products %>`)
  })

  test("does not flag a bare identifier in the shorthand form", () => {
    expectNoOffenses(`<%= render partial_name %>`)
  })

  test("does not flag a collection render with a literal path", () => {
    expectNoOffenses(`<%= render partial: "users/card", collection: @users %>`)
  })

  test("does not flag a render with no partial keyword", () => {
    expectNoOffenses(`<%= render template: "layouts/base" %>`)
  })

  test("does not flag a dynamic value in an unrelated keyword", () => {
    expectNoOffenses(`<%= render partial: "users/card", collection: @users.where(role: role) %>`)
  })

  test("does not flag a silent render, which actionview-no-silent-render owns", () => {
    expectNoOffenses('<% render partial: "users/#{user.role}" %>')
  })

  test("does not flag a trimmed silent render", () => {
    expectNoOffenses('<%- render partial: partial_name %>')
  })
})
