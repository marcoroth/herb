import dedent from "dedent"
import { describe, test } from "vitest"

import { PartialIndex } from "../../src/partial-index.js"
import { ActionViewRenderMissingStrictLocalsRule } from "../../src/rules/actionview-render-missing-strict-locals.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import type { PartialDeclaration } from "../../src/partial-index.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewRenderMissingStrictLocalsRule)

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

describe("actionview-render-missing-strict-locals", () => {
  test("flags a render call that omits a required local", () => {
    expectError("Partial `users/card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

    assertOffenses(`<%= render "users/card" %>`, context)
  })

  test("reports the offense on the partial name", () => {
    expectError("Partial `users/card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.", [1, 11])

    assertOffenses(`<%= render "users/card" %>`, context)
  })

  test("lists two missing locals", () => {
    expectError("Partial `users/avatar` requires `shape:` and `border:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass them to this `render` call.")

    assertOffenses(`<%= render "users/avatar", user: user %>`, context)
  })

  test("lists three missing locals", () => {
    expectError("Partial `users/avatar` requires `user:`, `shape:` and `border:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass them to this `render` call.")

    assertOffenses(`<%= render "users/avatar" %>`, context)
  })

  test("flags the explicit partial form", () => {
    expectError("Partial `users/card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

    assertOffenses(`<%= render partial: "users/card", locals: { size: 2 } %>`, context)
  })

  test("flags a render nested in markup", () => {
    expectError("Partial `users/card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

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
    expectError("Partial `card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

    assertOffenses(`<%= render "card" %>`, { fileName: "app/views/users/show.html.erb", partials })
  })

  test("resolves a bare partial name through the application directory", () => {
    expectError("Partial `flash` requires `message:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

    assertOffenses(`<%= render "flash" %>`, context)
  })

  test("does not flag a partial without a strict locals declaration", () => {
    expectNoOffenses(`<%= render "posts/plain" %>`, context)
  })

  test("still flags a required local when the declaration has a keyword rest", () => {
    expectError("Partial `posts/loose` requires `post:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

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
    expectError("Partial `users/card` requires `user:`. Rails raises `ActionView::StrictLocalsError` when a required local is missing, so pass it to this `render` call.")

    assertOffenses(`<%= render "users/card", size: 2 ** 3 %>`, context)
  })

  test("does not run without a partial index", () => {
    expectNoOffenses(`<%= render "users/card" %>`, { fileName: "app/views/posts/index.html.erb" })
  })
})
