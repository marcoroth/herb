import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoRenderOptionShadowingRule } from "../../src/rules/actionview-no-render-option-shadowing.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoRenderOptionShadowingRule)

describe("actionview-no-render-option-shadowing", () => {
  test("flags a local that shadows `layout:`", () => {
    expectInfo('The local `layout` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { layout: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", layout: "wide" %>`)
  })

  test("reports the offense on the keyword", () => {
    expectInfo('The local `layout` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { layout: ... }` hash so there is only one way to read it.', [1, 19])

    assertOffenses(`<%= render "card", layout: "wide" %>`)
  })

  test("flags a local that shadows `collection:`", () => {
    expectInfo('The local `collection` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { collection: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", collection: @products %>`)
  })

  test("flags a local that shadows `object:`", () => {
    expectInfo('The local `object` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { object: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", object: @product %>`)
  })

  test("flags a local that shadows `as:`", () => {
    expectInfo('The local `as` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { as: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", as: :item %>`)
  })

  test("flags every shadowing local in one call", () => {
    expectInfo('The local `spacer_template` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { spacer_template: ... }` hash so there is only one way to read it.')
    expectInfo('The local `formats` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { formats: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", spacer_template: "sep", formats: [:html] %>`)
  })

  test("flags a shadowing local alongside an ordinary one", () => {
    expectInfo('The local `layout` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { layout: ... }` hash so there is only one way to read it.')

    assertOffenses(`<%= render "card", layout: "wide", title: "Hi" %>`)
  })

  test("flags a shadowing local in a silent render", () => {
    expectInfo('The local `layout` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { layout: ... }` hash so there is only one way to read it.')

    assertOffenses(`<% render "card", layout: "wide" %>`)
  })

  test("flags a render nested in markup", () => {
    expectInfo('The local `layout` shadows the `render` option of the same name. Every keyword in the shorthand `render "partial", ...` form becomes a local, but the same keyword after `render partial: "..."` is a render option instead. Move it into an explicit `locals: { layout: ... }` hash so there is only one way to read it.')

    assertOffenses(dedent`
      <div class="page">
        <%= render "card", layout: "wide" %>
      </div>
    `)
  })

  test("does not flag render options used as options", () => {
    expectNoOffenses(`<%= render partial: "card", layout: "wide" %>`)
  })

  test("does not flag a collection render in the keyword form", () => {
    expectNoOffenses(`<%= render partial: "card", collection: @products, as: :item %>`)
  })

  test("does not flag ordinary locals", () => {
    expectNoOffenses(`<%= render "card", title: "Hi", user: @user %>`)
  })

  test("does not flag a render without locals", () => {
    expectNoOffenses(`<%= render "card" %>`)
  })

  test("does not flag a local whose name merely starts with an option name", () => {
    expectNoOffenses(`<%= render "card", layout_name: "wide", collection_size: 3 %>`)
  })

  test("does not flag an option name inside an explicit locals hash", () => {
    expectNoOffenses(`<%= render partial: "card", locals: { object: @product } %>`)
  })

  test("does not flag option names inside an explicit locals hash alongside others", () => {
    expectNoOffenses(`<%= render partial: "card", locals: { layout: "wide", collection: @items } %>`)
  })
})
