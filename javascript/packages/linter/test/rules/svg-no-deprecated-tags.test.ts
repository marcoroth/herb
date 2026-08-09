import { beforeAll, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { SVGNoDeprecatedTagsRule } from "../../src/rules/svg-no-deprecated-tags.js"
import { Linter } from "../../src/linter.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import {
  renderedFrom,
  renderedFromNowhere,
} from "../helpers/partial-caller-context.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  SVGNoDeprecatedTagsRule,
)

const PARTIAL = "app/views/shared/_icon.html.erb"

const message = (tagName: string) =>
  `SVG element \`<${tagName}>\` is deprecated and no longer supported in modern browsers.`

describe("svg-no-deprecated-tags", () => {
  test("passes for supported SVG elements", () => {
    expectNoOffenses(`
      <svg>
        <text x="0" y="20">Hello, SVG</text>
        <use href="#glyph" />
        <path d="M 0 0 L 10 10" />
      </svg>
    `)
  })

  test("reports every element removed from SVG 2", () => {
    const deprecatedElements = [
      "altGlyph",
      "altGlyphDef",
      "altGlyphItem",
      "cursor",
      "font",
      "font-face",
      "font-face-format",
      "font-face-name",
      "font-face-src",
      "font-face-uri",
      "glyph",
      "glyphRef",
      "hkern",
      "missing-glyph",
      "tref",
      "vkern",
    ]

    for (const tagName of deprecatedElements) {
      expectError(message(tagName))
    }

    assertOffenses(`
      <svg>
        ${deprecatedElements.map((tagName) => `<${tagName} />`).join("\n")}
      </svg>
    `)
  })

  test("matches deprecated element names case-insensitively", () => {
    expectError(message("GLYPHREF"))
    expectError(message("ALTGLYPH"))

    assertOffenses(`
      <svg>
        <GLYPHREF />
        <ALTGLYPH />
      </svg>
    `)
  })

  test("ignores matching element names outside SVG", () => {
    expectNoOffenses(`
      <div>
        <glyphRef />
        <altGlyph />
      </div>
    `)
  })

  test("reports deprecated tag helpers inside SVG", () => {
    expectError(message("glyphRef"))
    expectError(message("altGlyph"))

    assertOffenses(`
      <svg>
        <%= tag.glyphRef xlink_href: "#glyph" %>
        <%= content_tag :altGlyph, "Fallback" %>
      </svg>
    `)
  })

  describe("with the raw linter", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("marks offenses as deprecated", () => {
      const linter = new Linter(Herb, [SVGNoDeprecatedTagsRule])
      const result = linter.lint("<svg><glyphRef /></svg>")

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
      expect(result.offenses[0].severity).toBe("error")
    })
  })

  describe("across call sites", () => {
    test("reports deprecated tags when every call site renders the file inside an svg", () => {
      expectError(message("glyphRef"))

      assertOffenses(
        `<glyphRef />`,
        renderedFrom(PARTIAL, ["html", "body", "svg"]),
      )
    })

    test("stays quiet when only some call sites supply an svg", () => {
      expectNoOffenses(
        `<glyphRef />`,
        renderedFrom(PARTIAL, ["html", "body", "svg"], ["html", "body", "div"]),
      )
    })

    test("stays quiet when nothing renders the file", () => {
      expectNoOffenses(`<glyphRef />`, renderedFromNowhere(PARTIAL))
    })
  })
})
