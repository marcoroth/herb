import { describe, test } from "vitest"
import { HTMLNoPositiveTabIndexRule } from "../../src/rules/html-no-positive-tab-index.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoPositiveTabIndexRule)

describe("html-no-positive-tab-index", () => {
  test("passes for element without tabindex", () => {
    expectNoOffenses(`<button>Click me</button>`)
  })

  test("passes for tabindex=\"0\"", () => {
    expectNoOffenses(`<div tabindex="0">Focusable div</div>`)
  })

  test("passes for tabindex=\"-1\"", () => {
    expectNoOffenses(`<div tabindex="-1">Programmatically focusable div</div>`)
  })

  test("passes for negative tabindex values", () => {
    expectNoOffenses(`<div tabindex="-5">Skip in tab order</div>`)
  })

  test("fails for tabindex=\"1\"", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`<div tabindex="1">Bad tabindex</div>`)
  })

  test("fails for tabindex=\"2\"", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`<button tabindex="2">Bad button</button>`)
  })

  test("fails for high positive tabindex", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`<input tabindex="999" type="text">`)
  })

  test("handles multiple elements with mixed tabindex values", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`
      <button tabindex="0">OK</button>
      <button tabindex="1">Bad</button>
      <button tabindex="-1">Skip</button>
      <button tabindex="2">Also bad</button>
    `)
  })

  test("passes for non-numeric tabindex values", () => {
    expectNoOffenses(`<div tabindex="invalid">Should be handled by other rules</div>`)
  })

  test("passes for empty tabindex", () => {
    expectNoOffenses(`<div tabindex="">Empty value</div>`)
  })

  test("passes for tabindex with ERB content", () => {
    expectNoOffenses(`<div tabindex="<%= tab_index %>">Dynamic tabindex</div>`)
  })

  test("handles mixed case attribute names", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`<div TABINDEX="1">Mixed case</div>`)
  })

  test("handles tabindex with leading/trailing spaces", () => {
    expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    assertOffenses(`<div tabindex="  1  ">With spaces</div>`)
  })

  describe("ActionView tag helpers", () => {
    test("passes for tag.div with a zero tabindex", () => {
      expectNoOffenses('<%= tag.div tabindex: 0 %>')
    })

    test("fails for tag.div with a positive tabindex", () => {
      expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")

      assertOffenses('<%= tag.div tabindex: 5 %>')
    })

    test("fails for content_tag with a positive tabindex", () => {
      expectWarning("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")

      assertOffenses('<%= content_tag :div, "content", tabindex: 5 %>')
    })

    test("passes for a dynamic tabindex, which can't be resolved statically", () => {
      expectNoOffenses('<%= tag.div tabindex: index %>')
    })

    test("passes for an interpolated tabindex", () => {
      expectNoOffenses('<%= tag.div tabindex: "#{index}" %>')
    })

    test("passes for a nil tabindex, which ActionView omits entirely", () => {
      expectNoOffenses('<%= tag.div tabindex: nil %>')
    })
  })
})
