import { describe, it } from "vitest"
import { HTMLNoUnescapedEntitiesRule } from "../../src/rules/html-no-unescaped-entities.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoUnescapedEntitiesRule)

describe("html-no-unescaped-entities", () => {
  describe("attribute values - no offenses", () => {
    it("allows normal attribute values", () => {
      expectNoOffenses('<div class="hello"></div>')
    })

    it("allows properly escaped entities", () => {
      expectNoOffenses('<div data-html="&lt;br&gt;"></div>')
    })

    it("allows valid named character references", () => {
      expectNoOffenses('<a href="/path?a=1&amp;b=2">Link</a>')
    })

    it("allows numeric character references", () => {
      expectNoOffenses('<div data-char="&#60;&#62;"></div>')
    })

    it("allows hex character references", () => {
      expectNoOffenses('<div data-char="&#x3C;&#x3E;"></div>')
    })

    it("allows single quotes inside double-quoted values", () => {
      expectNoOffenses(`<div data-msg="it's fine"></div>`)
    })

    it("allows double quotes inside single-quoted values", () => {
      expectNoOffenses(`<div data-msg='she said "hi"'></div>`)
    })

    it("allows empty attribute values", () => {
      expectNoOffenses('<div data-value=""></div>')
    })

    it("allows attribute values with only escaped content", () => {
      expectNoOffenses('<div data-html="&lt;div class=&quot;test&quot;&gt;content&lt;/div&gt;"></div>')
    })
  })

  describe("attribute values - ERB content", () => {
    it("does not flag ERB output in attribute values", () => {
      expectNoOffenses('<div class="<%= value %>"></div>')
    })

    it("does not flag ERB output with method call containing quotes", () => {
      expectNoOffenses('<div data-something="<%= hello("hello") %>"></div>')
    })

    it("does not flag ERB output mixed with static text", () => {
      expectNoOffenses('<div data-value="prefix-<%= value %>-suffix"></div>')
    })

    it("does not flag > inside ERB in attribute value", () => {
      expectNoOffenses('<div data-value="<%= a > b ? "yes" : "no" %>"></div>')
    })

    it("does not flag & inside ERB in attribute value", () => {
      expectNoOffenses('<div data-value="<%= a & b %>"></div>')
    })

    it("does not flag angle brackets in ERB with surrounding static text", () => {
      expectNoOffenses('<div data-value="start-<%= items.select { |i| i > 0 } %>-end"></div>')
    })
  })

  describe("attribute values - unescaped < character", () => {
    it("flags unescaped < and > in attribute value", () => {
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-html="<br>"></div>')
    })

    it("flags unescaped < without >", () => {
      expectWarning("Attribute `data-expr` contains an unescaped `<` character. Use `&lt;` instead.")

      assertOffenses('<div data-expr="a < b"></div>')
    })
  })

  describe("attribute values - unescaped > character", () => {
    it("flags unescaped > in attribute value", () => {
      expectWarning("Attribute `data-expr` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-expr="a > b"></div>')
    })
  })

  describe("attribute values - unescaped & character", () => {
    it("flags bare & not part of a character reference", () => {
      expectWarning("Attribute `href` contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<a href="/path?a=1&b=2">Link</a>')
    })

    it("does not flag & that is part of a named reference", () => {
      expectNoOffenses('<a href="/path?a=1&amp;b=2">Link</a>')
    })

    it("does not flag & that is part of a numeric reference", () => {
      expectNoOffenses('<div data-char="&#60;"></div>')
    })

    it("does not flag & that is part of a hex reference", () => {
      expectNoOffenses('<div data-char="&#x3C;"></div>')
    })
  })

  describe("attribute values - multiple unescaped characters", () => {
    it("flags each occurrence of unescaped characters in one attribute", () => {
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-html="<b>bold</b>"></div>')
    })

    it("flags each occurrence of <, > and & together", () => {
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<div data-html="<b>bold & italic</b>"></div>')
    })
  })

  describe("dynamic attribute name with static value", () => {
    it("flags unescaped characters in static value with dynamic attribute name", () => {
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-<%= key %>="<br>"></div>')
    })

    it("allows properly escaped value with dynamic attribute name", () => {
      expectNoOffenses('<div data-<%= key %>="&lt;br&gt;"></div>')
    })
  })

  describe("static attribute name with mixed value", () => {
    it("flags each occurrence in the static portions of a mixed value", () => {
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-html` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-html="<b><%= content %></b>"></div>')
    })

    it("flags bare & in static portion of mixed value", () => {
      expectWarning("Attribute `href` contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<a href="/path?a=1&b=<%= value %>">Link</a>')
    })

    it("does not flag when static portions are clean", () => {
      expectNoOffenses('<div data-value="prefix-<%= value %>-suffix"></div>')
    })

    it("does not flag fully dynamic attribute value", () => {
      expectNoOffenses('<div class="<%= value %>"></div>')
    })
  })

  describe("dynamic attribute name with mixed value", () => {
    it("flags each occurrence in static portions with dynamic name", () => {
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `>` character. Use `&gt;` instead.")
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Attribute `data-<%= key %>` contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<div data-<%= key %>="<b><%= content %></b>"></div>')
    })

    it("does not flag when static portions are clean with dynamic name", () => {
      expectNoOffenses('<div data-<%= key %>="prefix-<%= value %>-suffix"></div>')
    })

    it("does not flag fully dynamic value with dynamic name", () => {
      expectNoOffenses('<div data-<%= key %>="<%= value %>"></div>')
    })
  })

  describe("text content - no offenses", () => {
    it("allows normal text content", () => {
      expectNoOffenses('<div>Hello world</div>')
    })

    it("allows escaped ampersand in text content", () => {
      expectNoOffenses('<div>Tom &amp; Jerry</div>')
    })

    it("allows numeric references in text content", () => {
      expectNoOffenses('<div>&#60;hello&#62;</div>')
    })
  })

  describe("text content - unescaped &", () => {
    it("flags bare & in text content", () => {
      expectWarning("Text content contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<div>Tom & Jerry</div>')
    })

    it("flags bare & in text with valid entities nearby", () => {
      expectWarning("Text content contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<div>a &amp; b & c</div>')
    })
  })

  describe("text content - unescaped < and >", () => {
    it("flags unescaped < in text content", () => {
      expectWarning("Text content contains an unescaped `<` character. Use `&lt;` instead.")

      assertOffenses('<p>Hello this is < content hello</p>')
    })

    it("flags unescaped > in text content", () => {
      expectWarning("Text content contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<p>a > b</p>')
    })

    it("flags both < and > in text content", () => {
      expectWarning("Text content contains an unescaped `<` character. Use `&lt;` instead.")
      expectWarning("Text content contains an unescaped `>` character. Use `&gt;` instead.")

      assertOffenses('<p>a < b > c</p>')
    })
  })

  describe("raw text elements - script and style", () => {
    it("does not flag bare & inside script text content", () => {
      expectNoOffenses('<script>var x = a & b;</script>')
    })

    it("does not flag bare & inside style text content", () => {
      expectNoOffenses('<style>.foo { content: "a & b"; }</style>')
    })

    it("still flags unescaped characters in script attribute values", () => {
      expectWarning("Attribute `data-config` contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<script data-config="a=1&b=2"></script>')
    })

    it("still flags unescaped characters in style attribute values", () => {
      expectWarning("Attribute `data-config` contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<style data-config="a=1&b=2"></style>')
    })
  })

  describe("raw text elements - javascript_tag helper", () => {
    it("does not flag bare & inside javascript_tag text content", () => {
      expectNoOffenses('<%= javascript_tag do %>var x = a & b;<% end %>')
    })

    it("does not flag bare & inside javascript_tag with nonce", () => {
      expectNoOffenses('<%= javascript_tag nonce: true do %>var x = a & b;<% end %>')
    })
  })

  describe("escapable raw text elements - textarea and title", () => {
    it("flags bare & inside textarea text content", () => {
      expectWarning("Text content contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<textarea>Tom & Jerry</textarea>')
    })

    it("flags bare & inside title text content", () => {
      expectWarning("Text content contains an unescaped `&` character. Use `&amp;` instead.")

      assertOffenses('<title>Tom & Jerry</title>')
    })
  })
})
