import { describe, test } from "vitest"
import { HTMLImgRequireAltRule } from "../../src/rules/html-img-require-alt.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLImgRequireAltRule)

describe("html-img-require-alt", () => {
  test("passes for img with alt attribute", () => {
    expectNoOffenses('<img src="/logo.png" alt="Company logo">')
  })

  test("passes for img with empty alt attribute", () => {
    expectNoOffenses('<img src="/divider.png" alt="">')
  })

  test("fails for img without alt attribute", () => {
    expectError('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png">')
  })

  test("fails for multiple img tags without alt", () => {
    expectError('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    expectError('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png"><img src="/banner.jpg">')
  })

  test("handles mixed case img tags", () => {
    expectError('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<IMG src="/logo.png">')
  })

  test("passes for img with ERB alt attribute", () => {
    expectNoOffenses('<img src="/avatar.jpg" alt="<%= user.name %>\'s profile picture">')
  })

  test("ignores non-img tags", () => {
    expectNoOffenses('<div src="/something.png"></div>')
  })

  test("handles self-closing img tags", () => {
    expectError('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    assertOffenses('<img src="/logo.png" />')
  })

  test("passes for case-insensitive alt attribute", () => {
    expectNoOffenses('<img src="/logo.png" ALT="Logo">')
  })
})
