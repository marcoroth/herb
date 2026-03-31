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

  describe("attribute values - no offenses for unescaped characters", () => {
    it("allows < in double-quoted attribute value", () => {
      expectNoOffenses('<div data-html="<br>"></div>')
    })

    it("allows < in single-quoted attribute value", () => {
      expectNoOffenses("<div data-html='<br>'></div>")
    })

    it("allows > in double-quoted attribute value", () => {
      expectNoOffenses('<div data-expr="a > b"></div>')
    })

    it("allows > in single-quoted attribute value", () => {
      expectNoOffenses("<div data-expr='a > b'></div>")
    })

    it("allows & in double-quoted attribute value", () => {
      expectNoOffenses('<a href="/path?a=1&b=2">Link</a>')
    })

    it("allows & in single-quoted attribute value", () => {
      expectNoOffenses("<a href='/path?a=1&b=2'>Link</a>")
    })

    it("allows multiple unescaped characters in attribute value", () => {
      expectNoOffenses('<div data-html="<b>bold & italic</b>"></div>')
    })

    it("allows Stimulus data-action syntax", () => {
      expectNoOffenses('<div data-action="click->controller#method"></div>')
    })

    it("allows Tailwind arbitrary value syntax", () => {
      expectNoOffenses('<div class="[&>p:not(:first-of-type)]:pt-4"></div>')
    })

    it("allows unescaped characters with dynamic attribute name", () => {
      expectNoOffenses('<div data-<%= key %>="<br>"></div>')
    })

    it("allows unescaped characters in mixed attribute value", () => {
      expectNoOffenses('<div data-html="<b><%= content %></b>"></div>')
    })

    it("allows bare & in mixed attribute value", () => {
      expectNoOffenses('<a href="/path?a=1&b=<%= value %>">Link</a>')
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

    it("allows unescaped characters in script attribute values", () => {
      expectNoOffenses('<script data-config="a=1&b=2"></script>')
    })

    it("allows unescaped characters in style attribute values", () => {
      expectNoOffenses('<style data-config="a=1&b=2"></style>')
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
