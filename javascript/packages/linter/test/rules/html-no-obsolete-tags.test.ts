import dedent from "dedent"
import { describe, test, expect } from "vitest"
import { HTMLNoObsoleteTagsRule, OBSOLETE_ELEMENT_REPLACEMENTS } from "../../src/rules/html-no-obsolete-tags.js"
import { HTML_DEPRECATED_ELEMENTS } from "../../src/utils/rule-utils.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoObsoleteTagsRule)

describe("html-no-obsolete-tags", () => {
  describe("conforming elements are allowed", () => {
    test("passes for ordinary markup", () => {
      expectNoOffenses(dedent`
        <div class="container">
          <p>Hello</p>
          <abbr title="HyperText Markup Language">HTML</abbr>
        </div>
      `)
    })

    test("passes for elements that only look obsolete", () => {
      expectNoOffenses(dedent`
        <rt>reading</rt>
        <rp>(</rp>
        <s>no longer accurate</s>
        <del>removed</del>
        <object data="movie.swf"></object>
      `)
    })

    test("passes for a custom element that starts with an obsolete name", () => {
      expectNoOffenses(`<font-picker></font-picker>`)
    })

    test("passes for an obsolete tag name inside an ERB comment", () => {
      expectNoOffenses(`<%# <marquee> was removed here %>`)
    })

    test("passes for an obsolete tag name inside an attribute value", () => {
      expectNoOffenses(`<div data-note="<center> is obsolete"></div>`)
    })
  })

  describe("obsolete elements are flagged", () => {
    test("fails for a presentational element", () => {
      expectWarning("`<center>` is an obsolete HTML element. Center the content with CSS instead.")

      assertOffenses(`<center>Welcome</center>`)
    })

    test("fails for a font element", () => {
      expectWarning("`<font>` is an obsolete HTML element. Set the font with CSS instead.")

      assertOffenses(`<font color="red">Warning</font>`)
    })

    test("fails for an animated element", () => {
      expectWarning("`<marquee>` is an obsolete HTML element. Use CSS animations instead.")

      assertOffenses(`<marquee>Breaking news</marquee>`)
    })

    test("fails for a frame set", () => {
      expectWarning("`<frameset>` is an obsolete HTML element. Lay the page out with CSS and use `<iframe>` for embedded documents instead.")
      expectWarning("`<frame>` is an obsolete HTML element. Use `<iframe>` instead.")
      expectWarning("`<noframes>` is an obsolete HTML element. Remove it together with the surrounding `<frameset>`.")

      assertOffenses(dedent`
        <frameset>
          <frame src="menu.html">
          <noframes>Frames are required.</noframes>
        </frameset>
      `)
    })

    test("fails for an element with no replacement", () => {
      expectWarning("`<nextid>` is an obsolete HTML element. Remove it, it has no replacement.")

      assertOffenses(`<nextid></nextid>`)
    })

    test("reports each occurrence", () => {
      expectWarning("`<big>` is an obsolete HTML element. Set the size with the CSS `font-size` property instead.")
      expectWarning("`<tt>` is an obsolete HTML element. Use `<code>`, `<kbd>`, `<samp>` or `<var>` instead.")
      expectWarning("`<strike>` is an obsolete HTML element. Use `<del>` for removed content or `<s>` for content that is no longer accurate instead.")

      assertOffenses(dedent`
        <p>
          <big>large</big>
          <tt>monospace</tt>
          <strike>struck</strike>
        </p>
      `)
    })

    test("fails for an uppercase tag name", () => {
      expectWarning("`<CENTER>` is an obsolete HTML element. Center the content with CSS instead.")

      assertOffenses(`<CENTER>Welcome</CENTER>`)
    })

    test("fails inside ERB control flow", () => {
      expectWarning("`<blink>` is an obsolete HTML element. Use CSS animations instead.")

      assertOffenses(dedent`
        <% if urgent? %>
          <blink>Act now</blink>
        <% end %>
      `)
    })

    test("fails for an Action View tag helper", () => {
      expectWarning("`<center>` is an obsolete HTML element. Center the content with CSS instead.")

      assertOffenses(`<%= tag.center do %>Welcome<% end %>`)
    })
  })

  describe("foreign content is left to the SVG rules", () => {
    test("passes for a deprecated SVG element that shares an HTML name", () => {
      expectNoOffenses(dedent`
        <svg>
          <font horiz-adv-x="1000"></font>
        </svg>
      `)
    })

    test("passes for an obsolete name nested deeper inside SVG", () => {
      expectNoOffenses(dedent`
        <svg>
          <defs>
            <font horiz-adv-x="1000"></font>
          </defs>
        </svg>
      `)
    })

    test("still fails after the SVG element closes", () => {
      expectWarning("`<font>` is an obsolete HTML element. Set the font with CSS instead.")

      assertOffenses(dedent`
        <svg></svg>
        <font color="red">Warning</font>
      `)
    })
  })

  describe("the replacement advice covers the registry", () => {
    test("every obsolete element has a replacement", () => {
      const missing = [...HTML_DEPRECATED_ELEMENTS].filter(name => !(name in OBSOLETE_ELEMENT_REPLACEMENTS))

      expect(missing).toEqual([])
    })

    test("every replacement names an obsolete element", () => {
      const extra = Object.keys(OBSOLETE_ELEMENT_REPLACEMENTS).filter(name => !HTML_DEPRECATED_ELEMENTS.has(name))

      expect(extra).toEqual([])
    })
  })
})
