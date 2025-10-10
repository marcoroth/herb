import { describe, test } from "vitest"
import { HTMLIframeHasTitleRule } from "../../src/rules/html-iframe-has-title.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLIframeHasTitleRule)

describe("html-iframe-has-title", () => {
  test("passes for iframe with title attribute", () => {
    expectNoOffenses(`<iframe src="https://example.com" title="Example website content"></iframe>`)
  })

  test("fails for iframe with empty title attribute", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<iframe src="https://example.com" title=""></iframe>`)
  })

  test("fails for iframe with empty title attribute", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<iframe src="https://example.com" title=" "></iframe>`)
  })

  test("fails for iframe without title attribute", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<iframe src="https://example.com"></iframe>`)
  })

  test("fails for self-closing iframe without title", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<iframe src="https://example.com" />`)
  })

  test("passes for iframe with descriptive title", () => {
    expectNoOffenses(`<iframe src="https://youtube.com/embed/123" title="Product demonstration video"></iframe>`)
  })

  test("ignores non-iframe elements", () => {
    expectNoOffenses(`<div src="https://example.com">Not an iframe</div>`)
  })

  test("ignores frame elements (different tag)", () => {
    expectNoOffenses(`<frame src="https://example.com"></frame>`)
  })

  test("handles mixed case iframe tag", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<IFRAME src="https://example.com"></IFRAME>`)
  })

  test("passes for mixed case title attribute", () => {
    expectNoOffenses(`<iframe src="https://example.com" TITLE="Example content"></iframe>`)
  })

  test("handles multiple iframe elements", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`
      <iframe src="https://example1.com" title="First iframe"></iframe>
      <iframe src="https://example2.com"></iframe>
      <iframe src="https://example3.com" title="Third iframe"></iframe>
    `)
  })

  test("passes for iframe with ERB title content", () => {
    expectNoOffenses(`<iframe src="https://example.com" title="<%= content_title %>"></iframe>`)
  })

  test("passes for iframe with multiple attributes", () => {
    expectNoOffenses(`<iframe src="https://example.com" width="600" height="400" frameborder="0" title="Embedded content"></iframe>`)
  })

  test("fails for iframe with other attributes but no title", () => {
    expectError("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
    assertOffenses(`<iframe src="https://example.com" width="600" height="400" frameborder="0"></iframe>`)
  })

  test("passes for iframe with aria-hidden='true'", () => {
    expectNoOffenses(`<iframe aria-hidden="true"></iframe>`)
  })
})
