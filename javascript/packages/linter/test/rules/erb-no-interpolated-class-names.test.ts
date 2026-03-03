import { describe, test } from "vitest"

import { ERBNoInterpolatedClassNamesRule } from "../../src/rules/erb-no-interpolated-class-names.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoInterpolatedClassNamesRule)

describe("ERBNoInterpolatedClassNamesRule", () => {
  describe("valid cases", () => {
    test("standalone ERB between static classes", () => {
      expectNoOffenses(`<div class="bg-blue-400 <%= attributes %> text-green-400"></div>`)
    })

    test("only ERB content", () => {
      expectNoOffenses(`<div class="<%= classes %>"></div>`)
    })

    test("multiple standalone ERBs", () => {
      expectNoOffenses(`<div class="<%= a %> bg-blue-500 <%= b %>"></div>`)
    })

    test("fully static class attribute", () => {
      expectNoOffenses(`<div class="bg-blue-400 text-white"></div>`)
    })

    test("non-class attribute with ERB interpolation", () => {
      expectNoOffenses(`<div id="prefix-<%= id %>"></div>`)
    })

    test("ERB in data attribute, not class", () => {
      expectNoOffenses(`<div data-value="item-<%= id %>-name" class="static-class"></div>`)
    })
  })

  describe("invalid cases", () => {
    test("ERB in middle of class name", () => {
      expectWarning("Avoid ERB interpolation inside class names: `bg-<%= color %>-400`. Use standalone ERB expressions that output complete class names instead.")

      assertOffenses(`<div class="bg-<%= color %>-400"></div>`)
    })

    test("ERB at end of class name, attached by hyphen", () => {
      expectWarning("Avoid ERB interpolation inside class names: `bg-<%= suffix %>`. Use standalone ERB expressions that output complete class names instead.")

      assertOffenses(`<div class="bg-<%= suffix %>"></div>`)
    })

    test("ERB at start of class name, attached by hyphen", () => {
      expectWarning("Avoid ERB interpolation inside class names: `<%= prefix %>-blue-500`. Use standalone ERB expressions that output complete class names instead.")

      assertOffenses(`<div class="<%= prefix %>-blue-500"></div>`)
    })

    test("two interpolated classes produce two offenses", () => {
      expectWarning("Avoid ERB interpolation inside class names: `foo-<%= bar %>-100`. Use standalone ERB expressions that output complete class names instead.")
      expectWarning("Avoid ERB interpolation inside class names: `baz-<%= qux %>-200`. Use standalone ERB expressions that output complete class names instead.")

      assertOffenses(`<div class="foo-<%= bar %>-100 baz-<%= qux %>-200"></div>`)
    })

    test("only interpolated class flagged, standalone and static left alone", () => {
      expectWarning("Avoid ERB interpolation inside class names: `bg-<%= color %>-400`. Use standalone ERB expressions that output complete class names instead.")

      assertOffenses(`<div class="bg-<%= color %>-400 <%= standalone %> text-white"></div>`)
    })
  })
})
