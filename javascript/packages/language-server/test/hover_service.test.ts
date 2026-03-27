import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Position, MarkupKind, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { HoverService } from "../src/hover_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("HoverService", () => {
  let parserService: ParserService
  let service: HoverService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new HoverService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getHover(content: string, line: number, character: number) {
    const document = createDocument(content)

    return service.getHover(document, Position.create(line, character))
  }

  function hoverValue(content: string, line: number, character: number): string {
    const hover = getHover(content, line, character)

    return (hover!.contents as { value: string }).value
  }

  function hoverRange(content: string, line: number, character: number): Range {
    const hover = getHover(content, line, character)

    return hover!.range!
  }

  describe("tag.* helpers", () => {
    it("shows hover for tag.div with block", () => {
      const content = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()
      expect(hover!.contents).toHaveProperty("kind", MarkupKind.Markdown)
      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        tag.<tag name>(optional content, options)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div>
          Content
        </div>
        \`\`\`

        [ActionView::Helpers::TagHelper#tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })

    it("shows hover for tag.div with attributes", () => {
      const content = '<%= tag.div class: "container" do %><% end %>'

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        tag.<tag name>(optional content, options)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div class="container"></div>
        \`\`\`

        [ActionView::Helpers::TagHelper#tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })

    it("shows hover for tag.p with content argument", () => {
      const content = '<%= tag.p "Hello" %>'

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        tag.<tag name>(optional content, options)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <p>Hello</p>
        \`\`\`

        [ActionView::Helpers::TagHelper#tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 9,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })
  })

  describe("content_tag", () => {
    it("shows hover for content_tag with block", () => {
      const content = '<%= content_tag :div do %><% end %>'

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        content_tag(name, content_or_options_with_block = nil, options = nil, escape = true, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div></div>
        \`\`\`

        [ActionView::Helpers::TagHelper#content_tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 15,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })

    it("shows hover for content_tag with content argument", () => {
      const content = '<%= content_tag :div, "Hello" %>'

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        content_tag(name, content_or_options_with_block = nil, options = nil, escape = true, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div>Hello</div>
        \`\`\`

        [ActionView::Helpers::TagHelper#content_tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 15,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })
  })

  describe("link_to", () => {
    it("shows hover for link_to", () => {
      const content = '<%= link_to "Home", root_path %>'

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        link_to(name = nil, options = nil, html_options = nil, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <a href="<%= root_path %>">Home</a>
        \`\`\`

        [ActionView::Helpers::UrlHelper#link_to](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)
    })
  })

  describe("hover range targets method name only", () => {
    it("only triggers hover on the method name for link_to", () => {
      const content = '<%= link_to "Home", root_path %>'

      expect(getHover(content, 0, 3)).toBeNull()
      expect(getHover(content, 0, 12)).toBeNull()
      expect(getHover(content, 0, 4)).not.toBeNull()
      expect(getHover(content, 0, 11)).not.toBeNull()
    })

    it("only triggers hover on the method name for tag.div", () => {
      const content = '<%= tag.div do %><% end %>'

      expect(getHover(content, 0, 3)).toBeNull()
      expect(getHover(content, 0, 12)).toBeNull()
      expect(getHover(content, 0, 4)).not.toBeNull()
      expect(getHover(content, 0, 11)).not.toBeNull()
    })

    it("only triggers hover on the method name for content_tag", () => {
      const content = '<%= content_tag :div do %><% end %>'

      expect(getHover(content, 0, 3)).toBeNull()
      expect(getHover(content, 0, 16)).toBeNull()
      expect(getHover(content, 0, 4)).not.toBeNull()
      expect(getHover(content, 0, 15)).not.toBeNull()
    })
  })

  describe("nested elements", () => {
    it("shows hover for each nested method name independently", () => {
      const content = dedent`
        <%= link_to "Devices", sessions_path do %>
          <%= tag.div class: "hello" %>
        <% end %>
      `

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        link_to(name = nil, options = nil, html_options = nil, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <a href="Devices">
          ...
        </a>
        \`\`\`

        [ActionView::Helpers::UrlHelper#link_to](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)

      expect(hoverValue(content, 1, 6)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        tag.<tag name>(optional content, options)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div class="hello"></div>
        \`\`\`

        [ActionView::Helpers::TagHelper#tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)"
      `)
      expect(hoverRange(content, 1, 6)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 13,
            "line": 1,
          },
          "start": {
            "character": 6,
            "line": 1,
          },
        }
      `)
    })

    it("does not show hover on body content between nested elements", () => {
      const content = dedent`
        <%= link_to "Devices", sessions_path do %>
          some text
        <% end %>
      `

      expect(getHover(content, 1, 5)).toBeNull()
    })

    it("shows shallow output with expandable details for deeply nested elements", () => {
      const content = dedent`
        <%= link_to "Devices", sessions_path do %>
          <%= tag.div class: "hello" do %>
            <%= content_tag :div, "Inner" %>
          <% end %>
        <% end %>
      `

      expect(hoverValue(content, 0, 5)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        link_to(name = nil, options = nil, html_options = nil, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <a href="Devices">
          ...
        </a>
        \`\`\`

        [ActionView::Helpers::UrlHelper#link_to](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)"
      `)
      expect(hoverRange(content, 0, 5)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 11,
            "line": 0,
          },
          "start": {
            "character": 4,
            "line": 0,
          },
        }
      `)

      expect(hoverValue(content, 1, 6)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        tag.<tag name>(optional content, options)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div class="hello">
          ...
        </div>
        \`\`\`

        [ActionView::Helpers::TagHelper#tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)"
      `)
      expect(hoverRange(content, 1, 6)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 13,
            "line": 1,
          },
          "start": {
            "character": 6,
            "line": 1,
          },
        }
      `)

      expect(hoverValue(content, 2, 8)).toMatchInlineSnapshot(`
        "\`\`\`ruby
        content_tag(name, content_or_options_with_block = nil, options = nil, escape = true, &block)
        \`\`\`

        **HTML equivalent**
        \`\`\`erb
        <div>Inner</div>
        \`\`\`

        [ActionView::Helpers::TagHelper#content_tag](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag)"
      `)
      expect(hoverRange(content, 2, 8)).toMatchInlineSnapshot(`
        {
          "end": {
            "character": 19,
            "line": 2,
          },
          "start": {
            "character": 8,
            "line": 2,
          },
        }
      `)
    })
  })

  describe("non-ActionView elements", () => {
    it("returns null for plain HTML elements", () => {
      expect(getHover("<div>hello</div>", 0, 2)).toBeNull()
    })

    it("returns null for plain text", () => {
      expect(getHover("just some text", 0, 5)).toBeNull()
    })

    it("returns null for regular ERB expressions", () => {
      expect(getHover("<%= some_method %>", 0, 5)).toBeNull()
    })
  })

  describe("character references", () => {
    describe("named character references", () => {
      it("shows hover for &lt;", () => {
        const hover = getHover("<div>&lt;</div>", 0, 6)

        expect(hover).not.toBeNull()
        expect(hover!.contents).toHaveProperty("kind", MarkupKind.Markdown)
        expect(hoverValue("<div>&lt;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`<\`

          **Named character reference**

          | | |
          |---|---|
          | Character | \`<\` |
          | Codepoint | U+003C |
          | Reference | \`&lt;\` |
          | Name | \`lt\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
        expect(hoverRange("<div>&lt;</div>", 0, 6)).toEqual(
          Range.create(0, 5, 0, 9)
        )
      })

      it("shows hover for &amp;", () => {
        expect(hoverValue("<div>&amp;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`&\`

          **Named character reference**

          | | |
          |---|---|
          | Character | \`&\` |
          | Codepoint | U+0026 |
          | Reference | \`&amp;\` |
          | Name | \`amp\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
      })

      it("shows hover for &copy;", () => {
        expect(hoverValue("<div>&copy;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`©\`

          **Named character reference**

          | | |
          |---|---|
          | Character | \`©\` |
          | Codepoint | U+00A9 |
          | Reference | \`&copy;\` |
          | Name | \`copy\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
      })

      it("shows hover for &nbsp;", () => {
        expect(hoverValue("<div>&nbsp;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \` \`

          **Named character reference**

          | | |
          |---|---|
          | Character | \` \` |
          | Codepoint | U+00A0 |
          | Reference | \`&nbsp;\` |
          | Name | \`nbsp\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
      })

      it("triggers on any character within the entity", () => {
        // &lt; spans positions 5-8
        expect(getHover("<div>&lt;</div>", 0, 5)).not.toBeNull()
        expect(getHover("<div>&lt;</div>", 0, 8)).not.toBeNull()
        expect(getHover("<div>&lt;</div>", 0, 9)).toBeNull()
      })
    })

    describe("decimal numeric character references", () => {
      it("shows hover for &#60;", () => {
        expect(hoverValue("<div>&#60;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`<\`

          **Decimal numeric character reference**

          | | |
          |---|---|
          | Character | \`<\` |
          | Codepoint | U+003C |
          | Reference | \`&#60;\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
        expect(hoverRange("<div>&#60;</div>", 0, 6)).toEqual(
          Range.create(0, 5, 0, 10)
        )
      })

      it("shows hover for &#169; (copyright)", () => {
        expect(hoverValue("<div>&#169;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`©\`

          **Decimal numeric character reference**

          | | |
          |---|---|
          | Character | \`©\` |
          | Codepoint | U+00A9 |
          | Reference | \`&#169;\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
      })
    })

    describe("hexadecimal numeric character references", () => {
      it("shows hover for &#x3C;", () => {
        expect(hoverValue("<div>&#x3C;</div>", 0, 6)).toMatchInlineSnapshot(`
          "## \`<\`

          **Hexadecimal numeric character reference**

          | | |
          |---|---|
          | Character | \`<\` |
          | Codepoint | U+003C |
          | Reference | \`&#x3C;\` |

          [HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)"
        `)
        expect(hoverRange("<div>&#x3C;</div>", 0, 6)).toEqual(
          Range.create(0, 5, 0, 11)
        )
      })
    })

    describe("in attribute values", () => {
      it("shows hover for entities in attribute values", () => {
        const hover = getHover('<div data-html="&lt;">test</div>', 0, 18)

        expect(hover).not.toBeNull()
        expect(hoverValue('<div data-html="&lt;">test</div>', 0, 18)).toContain("`<`")
        expect(hoverRange('<div data-html="&lt;">test</div>', 0, 18)).toEqual(
          Range.create(0, 16, 0, 20)
        )
      })
    })

    describe("multiple entities on same line", () => {
      it("shows correct hover for each entity", () => {
        expect(hoverValue("<div>&lt;&gt;</div>", 0, 6)).toContain("`<`")
        expect(hoverValue("<div>&lt;&gt;</div>", 0, 10)).toContain("`>`")
      })
    })

    describe("no hover for non-entities", () => {
      it("returns null for bare ampersand", () => {
        expect(getHover("<div>Tom & Jerry</div>", 0, 10)).toBeNull()
      })

      it("returns null for plain text", () => {
        expect(getHover("<div>hello</div>", 0, 7)).toBeNull()
      })

      it("returns null for invalid named reference", () => {
        expect(getHover("<div>&notarealentity;</div>", 0, 10)).toBeNull()
      })
    })
  })
})
