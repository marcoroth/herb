import { describe, it, expect, beforeAll } from "vitest"

import { SymbolKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Herb } from "@herb-tools/node-wasm"

import { DocumentSymbolService } from "../src/document_symbol_service"
import { ParserService } from "../src/parser_service"

import type { DocumentSymbol } from "vscode-languageserver/node"

describe("DocumentSymbolService", () => {
  let service: DocumentSymbolService

  beforeAll(async () => {
    await Herb.load()

    service = new DocumentSymbolService(new ParserService())
  })

  function symbols(content: string): DocumentSymbol[] {
    return service.getDocumentSymbols(TextDocument.create("file:///test.html.erb", "erb", 1, content))
  }

  function outline(content: string): string[] {
    const lines: string[] = []

    const walk = (nodes: DocumentSymbol[], depth: number) => {
      for (const node of nodes) {
        lines.push(`${"  ".repeat(depth)}${node.name}`)

        walk(node.children ?? [], depth + 1)
      }
    }

    walk(symbols(content), 0)

    return lines
  }

  it("returns nothing for a document without elements", () => {
    expect(symbols("just some text\n")).toEqual([])
  })

  it("reports a single element", () => {
    expect(outline("<div></div>")).toEqual(["div"])
  })

  it("nests elements", () => {
    expect(outline("<div><span><a></a></span></div>")).toEqual(["div", "  span", "    a"])
  })

  it("keeps siblings flat", () => {
    expect(outline("<div></div>\n<span></span>")).toEqual(["div", "span"])
  })

  it("qualifies an element by its id", () => {
    expect(outline(`<div id="main"></div>`)).toEqual(["div#main", "  [id]"])
  })

  it("qualifies an element by its classes", () => {
    expect(outline(`<div class="card featured"></div>`)).toEqual(["div.card.featured", "  [class]"])
  })

  it("combines the id and the classes", () => {
    expect(outline(`<div id="main" class="card"></div>`)).toEqual(["div#main.card", "  [id]", "  [class]"])
  })

  it("drops utility classes rather than burying the name", () => {
    const content = `<div class="flex items-center justify-between rounded-lg bg-white p-4"></div>`

    expect(outline(content)).toEqual(["div", "  [class]"])
  })

  it("keeps the id when the classes are dropped", () => {
    const content = `<div id="main" class="flex items-center justify-between p-4"></div>`

    expect(outline(content)).toEqual(["div#main", "  [id]", "  [class]"])
  })

  it("keeps classes right up to the limit", () => {
    expect(outline(`<div class="card featured"></div>`)).toEqual(["div.card.featured", "  [class]"])
    expect(outline(`<div class="card featured wide"></div>`)).toEqual(["div", "  [class]"])
  })

  it("ignores an id it cannot read statically", () => {
    expect(outline(`<div id="<%= dom_id(post) %>"></div>`)).toEqual(["div", "  [id]", "    dom_id(post)"])
  })

  it("reports a render call by the partial it renders", () => {
    expect(outline(`<%= render partial: "posts/card" %>`)).toEqual([`render posts/card`])
  })

  it("reports a positional render call", () => {
    expect(outline(`<%= render "posts/card" %>`)).toEqual([`render posts/card`])
  })

  it("reports a layout render", () => {
    expect(outline(`<%= render layout: "shared/wrapper" do %><% end %>`)).toEqual([`render shared/wrapper`])
  })

  it("falls back to a bare name for a render it cannot read", () => {
    expect(outline(`<%= render @post %>`)).toEqual(["render"])
  })

  it("nests a render inside the markup around it", () => {
    const content = `<ul class="list">\n  <li><%= render "posts/card" %></li>\n</ul>`

    expect(outline(content)).toEqual(["ul.list", "  [class]", "  li", "    render posts/card"])
  })

  it("uses Field for elements and Module for renders", () => {
    const [element] = symbols(`<div><%= render "posts/card" %></div>`)

    expect(element.kind).toBe(SymbolKind.Field)
    expect(element.children![0].kind).toBe(SymbolKind.Module)
  })

  it("selects the tag name rather than the whole element", () => {
    const content = `<div class="card">text</div>`
    const [element] = symbols(content)
    const document = TextDocument.create("file:///test.html.erb", "erb", 1, content)

    expect(document.getText(element.selectionRange)).toBe("div")
    expect(document.getText(element.range)).toBe(content)
  })

  it("spans the whole element including its children", () => {
    const content = `<div>\n  <span></span>\n</div>`
    const [element] = symbols(content)
    const document = TextDocument.create("file:///test.html.erb", "erb", 1, content)

    expect(document.getText(element.range)).toBe(content)
  })

  describe("attributes", () => {
    it("reports an attribute under the element that carries it", () => {
      expect(outline(`<div class="bg-white"></div>`)).toEqual(["div.bg-white", "  [class]"])
    })

    it("reports the ERB inside an attribute value", () => {
      const content = `<div class="bg-white <%= class_names(a, b) %>"></div>`

      expect(outline(content)).toEqual(["div", "  [class]", "    class_names(a, b)"])
    })

    it("reports every attribute in document order", () => {
      const content = `<a href="/posts" class="link" data-turbo="false"></a>`

      expect(outline(content)).toEqual(["a.link", "  [href]", "  [class]", "  [data-turbo]"])
    })

    it("keeps the attribute name out of the value", () => {
      expect(outline(`<div data-controller="dropdown"></div>`)).toEqual(["div", "  [data-controller]"])
    })

    it("reports an attribute on a tag helper", () => {
      expect(outline(`<%= tag.div data: { controller: "dropdown" } %>`)).toEqual(["div", "  [data-controller]"])
    })

    it("shortens a long ERB expression", () => {
      const content = `<div class="<%= class_names(a_very_long_helper_call_name, and_another_one) %>"></div>`
      const [, attribute] = outline(content)
      const [erb] = outline(content).slice(2)

      expect(attribute).toBe("  [class]")
      expect(erb.length).toBeLessThan(45)
      expect(erb).toContain("…")
    })

    it("selects the attribute name rather than the whole attribute", () => {
      const content = `<div class="bg-white"></div>`
      const [element] = symbols(content)
      const [attribute] = element.children!
      const document = TextDocument.create("file:///test.html.erb", "erb", 1, content)

      expect(document.getText(attribute.selectionRange)).toBe("class")
      expect(document.getText(attribute.range)).toBe(`class="bg-white"`)
    })

    it("uses Property for attributes and Variable for the ERB inside them", () => {
      const [element] = symbols(`<div class="<%= x %>"></div>`)
      const [attribute] = element.children!

      expect(attribute.kind).toBe(SymbolKind.Property)
      expect(attribute.children![0].kind).toBe(SymbolKind.Variable)
    })

    it("leaves ERB outside an attribute out of the tree", () => {
      expect(outline(`<div><%= post.title %></div>`)).toEqual(["div"])
    })
  })

  it("keeps a void element in the tree", () => {
    expect(outline(`<div><img></div>`)).toEqual(["div", "  img"])
  })

  describe("Action View tag helpers", () => {
    it("treats `tag.div` as an element", () => {
      expect(outline(`<%= tag.div do %>x<% end %>`)).toEqual(["div"])
    })

    it("treats `content_tag` as an element", () => {
      expect(outline(`<%= content_tag :section do %>x<% end %>`)).toEqual(["section"])
    })

    it("reads the classes off a tag helper", () => {
      expect(outline(`<%= tag.div class: "card" %>`)).toEqual(["div.card", "  [class]"])
    })

    it("reads an id off a tag helper", () => {
      expect(outline(`<%= content_tag :section, id: "main" do %>x<% end %>`)).toEqual(["section#main", "  [id]"])
    })

    it("nests markup inside a tag helper block", () => {
      const content = `<%= tag.div class: "card" do %>\n  <span></span>\n<% end %>`

      expect(outline(content)).toEqual(["div.card", "  [class]", "  span"])
    })

    it("nests a tag helper inside regular markup", () => {
      const content = `<ul>\n  <%= tag.li class: "row" %>\n</ul>`

      expect(outline(content)).toEqual(["ul", "  li.row", "    [class]"])
    })

    it("keeps a void tag helper in the tree", () => {
      expect(outline(`<%= tag.br %>`)).toEqual(["br"])
    })

    it("drops utility classes from a tag helper too", () => {
      expect(outline(`<%= tag.div class: "flex items-center p-4" %>`)).toEqual(["div", "  [class]"])
    })
  })

  it("nests markup under the conditional that guards it", () => {
    const content = `<% if signed_in? %>\n  <div></div>\n<% end %>`

    expect(outline(content)).toEqual(["if signed_in?", "  div"])
  })

  it("reports each branch of a conditional", () => {
    const content = `<% if a %>\n  <p></p>\n<% elsif b %>\n  <span></span>\n<% else %>\n  <em></em>\n<% end %>`

    expect(outline(content)).toEqual([
      "if a",
      "  p",
      "elsif b",
      "  span",
      "else",
      "  em",
    ])
  })

  it("reports an iteration block with its parameters", () => {
    const content = `<% posts.each do |post| %>\n  <li></li>\n<% end %>`

    expect(outline(content)).toEqual(["posts.each do |post|", "  li"])
  })

  it("reports a case with its branches", () => {
    const content = `<% case status %>\n<% when :active %>\n  <b></b>\n<% else %>\n  <i></i>\n<% end %>`

    expect(outline(content)).toEqual([
      "case status",
      "  when :active",
      "    b",
      "  else",
      "    i",
    ])
  })

  it("reports unless", () => {
    expect(outline(`<% unless hidden? %>\n  <div></div>\n<% end %>`)).toEqual(["unless hidden?", "  div"])
  })

  it("reports begin and rescue", () => {
    const content = `<% begin %>\n  <a></a>\n<% rescue => error %>\n  <b></b>\n<% end %>`

    expect(outline(content)).toEqual(["begin", "  a", "  rescue => error", "    b"])
  })

  it("uses Namespace for control flow", () => {
    const [conditional] = symbols(`<% if a %><div></div><% end %>`)

    expect(conditional.kind).toBe(SymbolKind.Namespace)
    expect(conditional.children![0].kind).toBe(SymbolKind.Field)
  })

  it("selects the ERB tag rather than the whole block", () => {
    const content = `<% if signed_in? %>\n  <div></div>\n<% end %>`
    const [conditional] = symbols(content)
    const document = TextDocument.create("file:///test.html.erb", "erb", 1, content)

    expect(document.getText(conditional.selectionRange)).toBe("<% if signed_in? %>")
    expect(document.getText(conditional.range)).toBe(content)
  })

  it("nests a render inside the loop that repeats it", () => {
    const content = `<% posts.each do |post| %>\n  <%= render "posts/card", post: post %>\n<% end %>`

    expect(outline(content)).toEqual(["posts.each do |post|", "  render posts/card"])
  })
})
