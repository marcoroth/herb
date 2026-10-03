import dedent from "dedent"
import { describe, test } from "vitest"

import { PartialIndex } from "@herb-tools/analysis"
import { ActionViewNoMistypedLocalsRule } from "../../src/rules/actionview-no-mistyped-locals.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import type { PartialDeclaration } from "@herb-tools/analysis"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ActionViewNoMistypedLocalsRule)

function declaration(file: string, locals: PartialDeclaration["locals"], overrides: Partial<PartialDeclaration> = {}): PartialDeclaration {
  return { file, hasDeclaration: true, hasKeywordRest: false, locals, ...overrides }
}

const partials = new PartialIndex("app/views", new Map([
  ["application/menu", declaration("app/views/application/_menu.html.erb", [
    { name: "open_initially", required: false, defaultSource: "false" },
    { name: "size", required: false, defaultSource: '"md"' },
    { name: "count", required: false, defaultSource: "0" },
    { name: "variant", required: false, defaultSource: "nil" },
    { name: "label", required: true },
  ])],
  ["posts/plain", declaration("app/views/posts/_plain.html.erb", [], { hasDeclaration: false })],
]))

const context = { fileName: "app/views/posts/index.html.erb", partials }

describe("ActionViewNoMistypedLocalsRule", () => {
  test("allows literals matching the declared default types", () => {
    expectNoOffenses(`<%= render "application/menu", open_initially: true, size: "lg", count: 3 %>`, context)
  })

  test("allows non-literal arguments", () => {
    expectNoOffenses(`<%= render "application/menu", open_initially: menu_open?, size: current_size %>`, context)
  })

  test("allows anything against a nil default", () => {
    expectNoOffenses(`<%= render "application/menu", variant: "wide" %>`, context)
  })

  test("allows anything against a local with no default", () => {
    expectNoOffenses(`<%= render "application/menu", label: 3 %>`, context)
  })

  test("allows nil against any declared type", () => {
    expectNoOffenses(`<%= render "application/menu", size: nil %>`, context)
  })

  test("allows a render of a partial with no declaration", () => {
    expectNoOffenses(`<%= render "posts/plain", anything: "goes" %>`, context)
  })

  test("checks nothing without a partial index", () => {
    expectNoOffenses(`<%= render "application/menu", open_initially: "yes" %>`, { fileName: "app/views/posts/index.html.erb" })
  })

  test("flags a String passed where the default is a Boolean", () => {
    expectWarning("`open_initially: \"yes\"` passes a String where the partial `application/menu` declares a Boolean default (`open_initially: false`). Pass a Boolean, or change the partial's default, since its reads of `open_initially` expect one.")

    assertOffenses(`<%= render "application/menu", open_initially: "yes" %>`, context)
  })

  test("flags a Symbol passed where the default is a String", () => {
    expectWarning("`size: :lg` passes a Symbol where the partial `application/menu` declares a String default (`size: \"md\"`). Pass a String, or change the partial's default, since its reads of `size` expect one.")

    assertOffenses(`<%= render "application/menu", size: :lg %>`, context)
  })

  test("flags an Integer local passed a String", () => {
    expectWarning("`count: \"3\"` passes a String where the partial `application/menu` declares an Integer default (`count: 0`). Pass an Integer, or change the partial's default, since its reads of `count` expect one.")

    assertOffenses(`<%= render "application/menu", count: "3" %>`, context)
  })

  test("flags through the locals: hash form", () => {
    expectWarning("`open_initially: \"yes\"` passes a String where the partial `application/menu` declares a Boolean default (`open_initially: false`). Pass a Boolean, or change the partial's default, since its reads of `open_initially` expect one.")

    assertOffenses(`<%= render partial: "application/menu", locals: { open_initially: "yes" } %>`, context)
  })
})
