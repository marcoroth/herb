import { describe, test } from "vitest"
import { A11yNoRedundantImageAltRule } from "../../src/rules/a11y-no-redundant-image-alt.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import dedent from "dedent"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoRedundantImageAltRule)

const MESSAGE = '`<img>` `alt` prop should not contain "image" or "picture" as screen readers already announce the element as an image.'

describe("a11y-no-redundant-image-alt", () => {
  describe("valid cases", () => {
    test("passes for img with descriptive alt", () => {
      expectNoOffenses('<img alt="Mona Lisa" src="monalisa.png">')
    })

    test("passes for img with detailed descriptive alt", () => {
      expectNoOffenses('<img alt="The original painting of Mona Lisa" src="monalisa.png">')
    })

    test("passes for img with screenshot in alt", () => {
      expectNoOffenses('<img alt="Screenshot of the Settings page" src="settings_page.png">')
    })

    test("passes for img with photograph in alt", () => {
      expectNoOffenses('<img alt="Photograph of a sunset" src="sunset.png">')
    })

    test("passes for img with painting in alt", () => {
      expectNoOffenses('<img alt="Painting of the night sky" src="night.png">')
    })

    test("passes for img with no alt attribute", () => {
      expectNoOffenses('<img src="decorative.png">')
    })

    test("passes for img with empty alt attribute", () => {
      expectNoOffenses('<img alt="" src="decorative.png">')
    })

    test("passes for img with ERB dynamic alt value", () => {
      expectNoOffenses('<img alt="<%= description %>" src="photo.png">')
    })

    test("passes for non-img elements", () => {
      expectNoOffenses('<div alt="image of something"></div>')
    })

    test("passes for img with word containing image as substring", () => {
      expectNoOffenses('<img alt="imagery of the forest" src="forest.png">')
    })
  })

  describe("invalid cases", () => {
    test("fails for alt containing 'picture'", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="picture of Mona Lisa" src="monalisa.png">')
    })

    test("fails for alt containing 'image'", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="image of a fluffy dog" src="dog.png">')
    })

    test("fails for alt containing 'Image' (case insensitive)", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="Image of a fluffy dog" src="dog.png">')
    })

    test("fails for alt containing 'PICTURE' (case insensitive)", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="PICTURE of a sunset" src="sunset.png">')
    })

    test("fails for alt containing 'image' among other words", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="an image showing the dashboard" src="dashboard.png">')
    })

    test("fails for alt that is just 'image'", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="image" src="photo.png">')
    })

    test("fails for alt that is just 'picture'", () => {
      expectWarning(MESSAGE)

      assertOffenses('<img alt="picture" src="photo.png">')
    })
  })

  describe("ERB open tag", () => {
    test("passes for image_tag with descriptive alt", () => {
      expectNoOffenses(dedent`
        <%= image_tag "monalisa.png", alt: "Mona Lisa" %>
      `)
    })
  })
})
