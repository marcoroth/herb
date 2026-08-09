import dedent from "dedent"
import { describe, test } from "vitest"

import { PartialIndex } from "@herb-tools/core"
import { ActionViewPreferQualifiedPartialPathRule } from "../../src/rules/actionview-prefer-qualified-partial-path.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import type { PartialDeclaration } from "@herb-tools/core"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewPreferQualifiedPartialPathRule)

function declaration(file: string): PartialDeclaration {
  return { file, hasDeclaration: false, hasKeywordRest: false, locals: [] }
}

const partials = new PartialIndex("app/views", new Map([
  ["posts/card", declaration("app/views/posts/_card.html.erb")],
  ["application/flash", declaration("app/views/application/_flash.html.erb")],
]))

const GENERIC = "The partial `card` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. Write the full path from the view root so it resolves to the same file from any template, and a search for that path finds every caller."

describe("actionview-prefer-qualified-partial-path", () => {
  test("flags an unqualified name in the shorthand form", () => {
    expectInfo(GENERIC)

    assertOffenses(`<%= render "card" %>`)
  })

  test("flags an unqualified name in the keyword form", () => {
    expectInfo(GENERIC)

    assertOffenses(`<%= render partial: "card" %>`)
  })

  test("reports the offense on the path", () => {
    expectInfo(GENERIC, [1, 11])

    assertOffenses(`<%= render "card" %>`)
  })

  test("flags an unqualified name passed with locals", () => {
    expectInfo(GENERIC)

    assertOffenses(`<%= render "card", user: @user %>`)
  })

  test("flags an unqualified name inside markup", () => {
    expectInfo(GENERIC)

    assertOffenses(dedent`
      <div class="row">
        <%= render "card" %>
      </div>
    `)
  })

  test("names the resolved path when the project's partials are known", () => {
    expectInfo("The partial `card` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. Write it as `posts/card` so it resolves to the same file from any template, and a search for `posts/card` finds every caller.")

    assertOffenses(`<%= render "card" %>`, { fileName: "app/views/posts/index.html.erb", partials })
  })

  test("names the resolved path when it comes from the application directory", () => {
    expectInfo("The partial `flash` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. Write it as `application/flash` so it resolves to the same file from any template, and a search for `application/flash` finds every caller.")

    assertOffenses(`<%= render "flash" %>`, { fileName: "app/views/posts/index.html.erb", partials })
  })

  test("falls back to the generic advice when the partial does not resolve", () => {
    expectInfo(GENERIC)

    assertOffenses(`<%= render "card" %>`, { fileName: "app/views/nowhere/index.html.erb", partials: new PartialIndex("app/views", new Map()) })
  })

  test("does not flag a qualified path in the shorthand form", () => {
    expectNoOffenses(`<%= render "posts/card" %>`)
  })

  test("does not flag a qualified path in the keyword form", () => {
    expectNoOffenses(`<%= render partial: "posts/card", locals: { post: @post } %>`)
  })

  test("does not flag a deeply qualified path", () => {
    expectNoOffenses(`<%= render "admin/posts/card" %>`)
  })

  test("does not flag a dynamic path", () => {
    expectNoOffenses('<%= render partial: "#{prefix}" %>')
  })

  test("does not flag an object render", () => {
    expectNoOffenses(`<%= render @products %>`)
  })

  test("does not flag a collection render with a qualified path", () => {
    expectNoOffenses(`<%= render partial: "posts/card", collection: @posts %>`)
  })

  test("does not flag a template render", () => {
    expectNoOffenses(`<%= render template: "base" %>`)
  })

  test("does not flag a silent render, which actionview-no-silent-render owns", () => {
    expectNoOffenses(`<% render "card" %>`)
  })

  test("does not flag a trimmed silent render", () => {
    expectNoOffenses(`<%- render partial: "card" %>`)
  })
})
