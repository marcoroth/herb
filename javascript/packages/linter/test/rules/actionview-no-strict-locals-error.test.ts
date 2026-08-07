import dedent from "dedent"
import { describe, test } from "vitest"

import { PartialIndex } from "@herb-tools/core"
import { ActionViewNoStrictLocalsErrorRule } from "../../src/rules/actionview-no-strict-locals-error.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import type { PartialDeclaration } from "@herb-tools/core"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoStrictLocalsErrorRule)

function declaration(file: string, locals: PartialDeclaration["locals"], overrides: Partial<PartialDeclaration> = {}): PartialDeclaration {
  return { file, hasDeclaration: true, hasKeywordRest: false, locals, ...overrides }
}

const partials = new PartialIndex("app/views", new Map([
  ["users/card", declaration("app/views/users/_card.html.erb", [
    { name: "user", required: true },
    { name: "size", required: false },
  ])],
  ["users/avatar", declaration("app/views/users/_avatar.html.erb", [
    { name: "user", required: true },
    { name: "shape", required: true },
    { name: "border", required: true },
  ])],
  ["application/flash", declaration("app/views/application/_flash.html.erb", [
    { name: "message", required: true },
  ])],
  ["posts/plain", declaration("app/views/posts/_plain.html.erb", [], { hasDeclaration: false })],
  ["posts/loose", declaration("app/views/posts/_loose.html.erb", [
    { name: "post", required: true },
  ], { hasKeywordRest: true })],
]))

const context = { fileName: "app/views/posts/index.html.erb", partials }

describe("actionview-no-strict-locals-error", () => {
  test("flags a render call that omits a required local", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render "users/card" %>`, context)
  })

  test("reports the offense on the partial name", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.", [1, 11])

    assertOffenses(`<%= render "users/card" %>`, context)
  })

  test("lists two missing locals", () => {
    expectError("The partial `users/avatar` requires the `shape:` and `border:` locals to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add them to this `render` call.")

    assertOffenses(`<%= render "users/avatar", user: user %>`, context)
  })

  test("lists three missing locals", () => {
    expectError("The partial `users/avatar` requires the `user:`, `shape:` and `border:` locals to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add them to this `render` call.")

    assertOffenses(`<%= render "users/avatar" %>`, context)
  })

  test("flags the explicit partial form", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render partial: "users/card", locals: { size: 2 } %>`, context)
  })

  test("flags a render nested in markup", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(dedent`
      <div class="cards">
        <%= render "users/card", size: 2 %>
      </div>
    `, context)
  })

  test("does not flag a render call that passes the required local", () => {
    expectNoOffenses(`<%= render "users/card", user: user %>`, context)
  })

  test("does not flag the explicit partial form with the required local", () => {
    expectNoOffenses(`<%= render partial: "users/card", locals: { user: user } %>`, context)
  })

  test("does not flag a missing optional local", () => {
    expectNoOffenses(`<%= render "users/card", user: user %>`, context)
  })

  test("resolves a bare partial name against the rendering template's directory", () => {
    expectError("The partial `card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render "card" %>`, { fileName: "app/views/users/show.html.erb", partials })
  })

  test("resolves a bare partial name through the application directory", () => {
    expectError("The partial `flash` requires the `message:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render "flash" %>`, context)
  })

  test("does not flag a partial without a strict locals declaration", () => {
    expectNoOffenses(`<%= render "posts/plain" %>`, context)
  })

  test("still flags a required local when the declaration has a keyword rest", () => {
    expectError("The partial `posts/loose` requires the `post:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render "posts/loose" %>`, context)
  })

  test("does not flag a partial that cannot be resolved", () => {
    expectNoOffenses(`<%= render "users/missing" %>`, context)
  })

  test("does not flag a dynamic partial name", () => {
    expectNoOffenses(`<%= render partial_name %>`, context)
  })

  test("does not flag an interpolated partial name", () => {
    expectNoOffenses('<%= render "users/#{kind}" %>', context)
  })

  test("does not flag a keyword splat", () => {
    expectNoOffenses(`<%= render "users/card", **locals %>`, context)
  })

  test("does not flag a splat inside the locals hash", () => {
    expectNoOffenses(`<%= render partial: "users/card", locals: { **locals } %>`, context)
  })

  test("does not flag a locals hash that is not a literal", () => {
    expectNoOffenses(`<%= render partial: "users/card", locals: locals_hash %>`, context)
  })

  test("does not flag a collection render", () => {
    expectNoOffenses(`<%= render partial: "users/card", collection: @users %>`, context)
  })

  test("does not flag an object render", () => {
    expectNoOffenses(`<%= render partial: "users/card", object: @user %>`, context)
  })

  test("does not treat exponentiation as a splat", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")

    assertOffenses(`<%= render "users/card", size: 2 ** 3 %>`, context)
  })

  test("flags a local the partial does not declare", () => {
    expectError("The partial `users/card` does not declare the `color:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.")

    assertOffenses(`<%= render "users/card", user: user, color: "red" %>`, context)
  })

  test("reports the offense on the undeclared local", () => {
    expectError("The partial `users/card` does not declare the `color:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.", [1, 37])

    assertOffenses(`<%= render "users/card", user: user, color: "red" %>`, context)
  })

  test("reports each undeclared local separately", () => {
    expectError("The partial `users/card` does not declare the `color:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.")
    expectError("The partial `users/card` does not declare the `shape:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.")

    assertOffenses(`<%= render "users/card", user: user, color: "red", shape: "round" %>`, context)
  })

  test("flags an undeclared local in the explicit partial form", () => {
    expectError("The partial `users/card` does not declare the `color:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.")

    assertOffenses(`<%= render partial: "users/card", locals: { user: user, color: "red" } %>`, context)
  })

  test("reports a missing and an undeclared local from the same call", () => {
    expectError("The partial `users/card` requires the `user:` local to be passed. Rails raises an `ActionView::StrictLocalsError` when a required local is missing, so add it to this `render` call.")
    expectError("The partial `users/card` does not declare the `color:` local. Rails raises an `ActionView::StrictLocalsError` when a caller passes an undeclared local, so remove it from this `render` call, or add it to the partial's `<%# locals: () %>` declaration.")

    assertOffenses(`<%= render "users/card", color: "red" %>`, context)
  })

  test("does not flag an optional local that the partial declares", () => {
    expectNoOffenses(`<%= render "users/card", user: user, size: 2 %>`, context)
  })

  test("does not flag undeclared locals when the declaration has a keyword rest", () => {
    expectNoOffenses(`<%= render "posts/loose", post: post, anything: 1 %>`, context)
  })

  test("does not flag undeclared locals for a partial without a declaration", () => {
    expectNoOffenses(`<%= render "posts/plain", anything: 1 %>`, context)
  })

  test("does not flag undeclared locals behind a keyword splat", () => {
    expectNoOffenses(`<%= render "users/card", user: user, **extra %>`, context)
  })

  test("does not flag undeclared locals for an unresolvable partial", () => {
    expectNoOffenses(`<%= render "users/missing", anything: 1 %>`, context)
  })

  test("does not flag undeclared locals on a collection render", () => {
    expectNoOffenses(`<%= render partial: "users/card", collection: @users, locals: { anything: 1 } %>`, context)
  })

  test("does not run without a partial index", () => {
    expectNoOffenses(`<%= render "users/card" %>`, { fileName: "app/views/posts/index.html.erb" })
  })
})
