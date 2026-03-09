import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { InlayHintKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { InlayHintService } from "../src/inlay_hint_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("InlayHintService", () => {
  let parserService: ParserService
  let service: InlayHintService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new InlayHintService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getHints(content: string) {
    return service.getInlayHints(createDocument(content))
  }

  describe("ERB if/end", () => {
    it("shows hint on end tag for multi-line if block", () => {
      const hints = getHints(dedent`
        <% if user.admin? %>
          <p>Admin</p>
          <p>Content</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # if user.admin?")
      expect(hints[0].kind).toBe(InlayHintKind.Parameter)
      expect(hints[0].paddingLeft).toBe(true)
    })

    it("does not show hint when if block spans 2 lines or fewer", () => {
      const hints = getHints(dedent`
        <% if user.admin? %>
        <% end %>
      `)

      expect(hints).toHaveLength(0)
    })
  })

  describe("ERB unless/end", () => {
    it("shows hint on end tag for multi-line unless block", () => {
      const hints = getHints(dedent`
        <% unless user.admin? %>
          <p>Line 1</p>
          <p>Line 2</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # unless user.admin?")
    })

    it("does not show hint for short unless block", () => {
      const hints = getHints(dedent`
        <% unless user.admin? %>
        <% end %>
      `)

      expect(hints).toHaveLength(0)
    })
  })

  describe("ERB block/end (each, do)", () => {
    it("shows hint on end tag for multi-line block", () => {
      const hints = getHints(dedent`
        <% items.each do |item| %>
          <p>Line 1</p>
          <p>Line 2</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # items.each do |item|")
    })

    it("does not show hint for short block", () => {
      const hints = getHints(dedent`
        <% items.each do |item| %>
        <% end %>
      `)

      expect(hints).toHaveLength(0)
    })
  })

  describe("ERB case/end", () => {
    it("shows hint on end tag for multi-line case block", () => {
      const hints = getHints(dedent`
        <% case role %>
        <% when "admin" %>
          <p>Admin</p>
        <% when "user" %>
          <p>User</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # case role")
    })
  })

  describe("ERB case/in (pattern matching)", () => {
    it("shows hint on end tag for multi-line case/in block", () => {
      const hints = getHints(dedent`
        <% case value %>
        <% in String %>
          <p>String</p>
        <% in Integer %>
          <p>Integer</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # case value")
    })
  })

  describe("ERB while/end", () => {
    it("shows hint on end tag for multi-line while block", () => {
      const hints = getHints(dedent`
        <% while counter < 10 %>
          <p>Line 1</p>
          <p>Line 2</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # while counter < 10")
    })
  })

  describe("ERB until/end", () => {
    it("shows hint on end tag for multi-line until block", () => {
      const hints = getHints(dedent`
        <% until counter >= 10 %>
          <p>Line 1</p>
          <p>Line 2</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # until counter >= 10")
    })
  })

  describe("ERB for/end", () => {
    it("shows hint on end tag for multi-line for block", () => {
      const hints = getHints(dedent`
        <% for i in 1..10 %>
          <p>Line 1</p>
          <p>Line 2</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # for i in 1..10")
    })
  })

  describe("ERB begin/end", () => {
    it("shows hint on end tag for multi-line begin block", () => {
      const hints = getHints(dedent`
        <% begin %>
          <%= risky_operation %>
          <p>More content</p>
        <% rescue StandardError => e %>
          <p>Error</p>
        <% end %>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" # begin")
    })
  })

  describe("HTML elements with id", () => {
    it("shows hint with id on closing tag for multi-line element", () => {
      const hints = getHints(dedent`
        <div id="main">
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" <!-- #main -->")
      expect(hints[0].kind).toBe(InlayHintKind.Parameter)
      expect(hints[0].paddingLeft).toBe(true)
    })

    it("does not show hint for short elements", () => {
      const hints = getHints(dedent`
        <div id="main">
        </div>
      `)

      expect(hints).toHaveLength(0)
    })
  })

  describe("HTML elements with class", () => {
    it("shows hint with class on closing tag for multi-line element", () => {
      const hints = getHints(dedent`
        <div class="container">
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" <!-- .container -->")
    })

    it("joins multiple classes with dots", () => {
      const hints = getHints(dedent`
        <div class="flex items-center p-4">
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" <!-- .flex.items-center.p-4 -->")
    })
  })

  describe("HTML elements - id takes precedence over class", () => {
    it("shows id hint when both id and class are present", () => {
      const hints = getHints(dedent`
        <div id="main" class="container">
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      `)

      expect(hints).toHaveLength(1)
      expect(hints[0].label).toBe(" <!-- #main -->")
    })
  })

  describe("HTML elements without id or class", () => {
    it("does not show hint when element has no id or class", () => {
      const hints = getHints(dedent`
        <div>
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      `)

      expect(hints).toHaveLength(0)
    })
  })

  describe("nested structures", () => {
    it("shows hints for multiple nested elements", () => {
      const hints = getHints(dedent`
        <div id="outer">
          <% if user.admin? %>
            <div class="inner">
              <p>Line 1</p>
              <p>Line 2</p>
            </div>
          <% end %>
        </div>
      `)

      expect(hints).toHaveLength(3)
      expect(hints[0].label).toBe(" <!-- #outer -->")
      expect(hints[1].label).toBe(" # if user.admin?")
      expect(hints[2].label).toBe(" <!-- .inner -->")
    })
  })

  describe("edge cases", () => {
    it("returns no hints for empty document", () => {
      const hints = getHints("")
      expect(hints).toHaveLength(0)
    })

    it("returns no hints for plain text", () => {
      const hints = getHints("Just plain text")
      expect(hints).toHaveLength(0)
    })

    it("returns no hints for single-line elements", () => {
      const hints = getHints('<div id="main">Content</div>')
      expect(hints).toHaveLength(0)
    })
  })
})
