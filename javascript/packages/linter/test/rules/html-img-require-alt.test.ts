import { describe, test } from "vitest"
import { HTMLImgRequireAltRule } from "../../src/rules/html-img-require-alt.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLImgRequireAltRule)

describe("html-img-require-alt", () => {
  test("passes for img with alt attribute", () => {
    expectNoOffenses('<img src="/logo.png" alt="Company logo">')
  })

  test("passes for img with empty alt attribute", () => {
    expectNoOffenses('<img src="/divider.png" alt="">')
  })

  test("fails for img without alt attribute", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png">')
  })

  test("fails for multiple img tags without alt", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png"><img src="/banner.jpg">')
  })

  test("handles mixed case img tags", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<IMG src="/logo.png">')
  })

  test("passes for img with ERB alt attribute", () => {
    expectNoOffenses('<img src="/avatar.jpg" alt="<%= user.name %>\'s profile picture">')
  })

  test("ignores non-img tags", () => {
    expectNoOffenses('<div src="/something.png"></div>')
  })

  test("handles self-closing img tags", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png" />')
  })

  test("passes for case-insensitive alt attribute", () => {
    expectNoOffenses('<img src="/logo.png" ALT="Logo">')
  })

  test("fails for img with alt attribute without value", () => {
    expectWarning('The `alt` attribute has no value. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/avatar.jpg" alt>')
  })

  test("passes for image_tag helper with alt attribute", () => {
    expectNoOffenses('<%= image_tag "logo.png", alt: "Company logo" %>')
  })

  test("fails for image_tag helper without alt attribute", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<%= image_tag "logo.png" %>')
  })

  test("passes for image_tag helper with empty alt attribute", () => {
    expectNoOffenses('<%= image_tag "logo.png", alt: "" %>')
  })

  test("fails for image_tag helper with ruby expression and no alt", () => {
    expectWarning('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<%= image_tag user.avatar %>')
  })
})
