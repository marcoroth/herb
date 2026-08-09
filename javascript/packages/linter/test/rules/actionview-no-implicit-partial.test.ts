import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoImplicitPartialRule } from "../../src/rules/actionview-no-implicit-partial.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoImplicitPartialRule)

function message(object: string): string {
  return `Rails derives the partial from \`to_partial_path\` on \`${object}\` when the template renders, so the template this renders is not named in this \`<%= render %>\` call. Name it explicitly, with \`object:\` for a single record or \`collection:\` for many, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them.`
}

describe("actionview-no-implicit-partial", () => {
  test("flags a collection render that infers the partial", () => {
    expectInfo(message("@products"))

    assertOffenses(`<%= render @products %>`)
  })

  test("reports the offense on the object", () => {
    expectInfo(message("@products"), [1, 11])

    assertOffenses(`<%= render @products %>`)
  })

  test("flags a single object render", () => {
    expectInfo(message("@product"))

    assertOffenses(`<%= render @product %>`)
  })

  test("flags a local used as the object", () => {
    expectInfo(message("product"))

    assertOffenses(`<%= render product %>`)
  })

  test("flags a method call used as the object", () => {
    expectInfo(message("current_user.notifications"))

    assertOffenses(`<%= render current_user.notifications %>`)
  })

  test("flags an implicit render inside markup", () => {
    expectInfo(message("@products"))

    assertOffenses(dedent`
      <ul class="list">
        <%= render @products %>
      </ul>
    `)
  })

  test("does not flag an object render that names the partial", () => {
    expectNoOffenses(`<%= render @products, partial: "product" %>`)
  })

  test("does not flag the keyword form", () => {
    expectNoOffenses(`<%= render partial: "product", collection: @products %>`)
  })

  test("does not flag the keyword form with as:", () => {
    expectNoOffenses(`<%= render partial: "product", collection: @products, as: :item %>`)
  })

  test("does not flag a literal partial path", () => {
    expectNoOffenses(`<%= render "products/product" %>`)
  })

  test("does not flag an unqualified literal path", () => {
    expectNoOffenses(`<%= render "product" %>`)
  })

  test("does not flag an interpolated path", () => {
    expectNoOffenses('<%= render "products/#{kind}" %>')
  })

  test("does not flag a dynamic path named with partial:", () => {
    expectNoOffenses(`<%= render partial: partial_name %>`)
  })

  test("does not flag a ViewComponent render", () => {
    expectNoOffenses(`<%= render FlashComponent.new(flash: flash) %>`)
  })

  test("does not flag a namespaced component render", () => {
    expectNoOffenses(`<%= render Primer::Alpha::Banner.new(type: :warning) %>`)
  })

  test("does not flag a component render with a chained call", () => {
    expectNoOffenses(`<%= render Primer::Beta::Flash.new(scheme: :danger).with_content("x") %>`)
  })

  test("does not flag a component render without arguments", () => {
    expectNoOffenses(`<%= render LoadingSpinner::Component.new %>`)
  })

  test("does not flag a silent render, which actionview-no-silent-render owns", () => {
    expectNoOffenses(`<% render @products %>`)
  })

  test("does not flag a trimmed silent render", () => {
    expectNoOffenses(`<%- render @products %>`)
  })

  test("does not flag a template render", () => {
    expectNoOffenses(`<%= render template: "layouts/base" %>`)
  })

  test("does not flag a literal path with locals", () => {
    expectNoOffenses(`<%= render "products/product", product: @product %>`)
  })

  test("does not flag a component built by a factory helper", () => {
    expectNoOffenses(`<%= render component("ui/modal").new(title: "Hi") %>`)
  })

  test("does not flag a component built from a method receiver", () => {
    expectNoOffenses(`<%= render current_component.new(title: "SEO") %>`)
  })

  test("does not flag a component built from an instance variable", () => {
    expectNoOffenses(`<%= render @layout.new(facet_field: @facet_field) %>`)
  })

  test("does not flag a ternary between literal partial names", () => {
    expectNoOffenses(`<%= render card_view? ? "card_view" : "table_view" %>`)
  })
})
