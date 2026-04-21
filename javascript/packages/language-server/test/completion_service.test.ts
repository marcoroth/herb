import { describe, it, expect, beforeAll } from "vitest"
import { CompletionItemKind, InsertTextFormat, MarkupKind, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Herb } from "@herb-tools/node-wasm"
import { CompletionService } from "../src/completion_service"
import { ParserService } from "../src/parser_service"

describe("CompletionService", () => {
  let service: CompletionService

  beforeAll(async () => {
    await Herb.load()
    const parserService = new ParserService()
    service = new CompletionService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getCompletions(content: string, line: number, character: number) {
    const document = createDocument(content)
    return service.getCompletions(document, Position.create(line, character))
  }

  function completionLabels(content: string, line: number, character: number): string[] {
    const result = getCompletions(content, line, character)
    if (!result) return []
    return result.items.map(item => item.label)
  }

  describe("tag. completions", () => {
    it("returns all HTML tags after 'tag.'", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThan(100)

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("div")
      expect(labels).toContain("span")
      expect(labels).toContain("p")
      expect(labels).toContain("button")
      expect(labels).toContain("input")
      expect(labels).toContain("a")
    })

    it("filters tags by prefix", () => {
      const labels = completionLabels("<%= tag.d %>", 0, 9)

      expect(labels).toContain("div")
      expect(labels).toContain("dl")
      expect(labels).toContain("dd")
      expect(labels).toContain("dt")
      expect(labels).toContain("data")
      expect(labels).toContain("details")
      expect(labels).toContain("dialog")
      expect(labels).not.toContain("span")
      expect(labels).not.toContain("p")
    })

    it("filters with longer prefix", () => {
      const labels = completionLabels("<%= tag.di %>", 0, 10)

      expect(labels).toContain("div")
      expect(labels).toContain("dialog")
      expect(labels).not.toContain("dl")
      expect(labels).not.toContain("span")
    })

    it("returns completions with correct kind and detail", () => {
      const result = getCompletions("<%= tag.d %>", 0, 9)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem).toBeDefined()
      expect(divItem!.kind).toBe(CompletionItemKind.Property)
      expect(divItem!.detail).toBe("tag.div — Generic container")
    })

    it("preselects common tags", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      const datalistItem = result!.items.find(item => item.label === "datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBe(false)
    })

    it("sorts common tags before uncommon ones", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      const datalistItem = result!.items.find(item => item.label === "datalist")

      expect(divItem!.sortText! < datalistItem!.sortText!).toBe(true)
    })

    it("uses sortText starting with ! for high priority", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()
      expect(result!.items.every(item => item.sortText!.startsWith("!"))).toBe(true)
    })

    it("uses snippet with do/end for non-void tags when no closing tag", () => {
      const result = getCompletions("<%= tag.", 0, 8)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem!.insertTextFormat).toBe(InsertTextFormat.Snippet)
      expect(divItem!.insertText).toBe("div do %>$0<% end %>")
    })

    it("uses snippet without do/end for void tags when no closing tag", () => {
      const result = getCompletions("<%= tag.", 0, 8)

      expect(result).not.toBeNull()

      const brItem = result!.items.find(item => item.label === "br")
      expect(brItem!.insertTextFormat).toBe(InsertTextFormat.Snippet)
      expect(brItem!.insertText).toBe("br $0 %>")
    })

    it("inserts plain tag name when closing %> already exists", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem!.insertTextFormat).toBe(InsertTextFormat.PlainText)
      expect(divItem!.insertText).toBe("div")
    })

    it("inserts plain tag name when closing %> exists with space", () => {
      const result = getCompletions("<%  tag.  %>", 0, 8)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem!.insertTextFormat).toBe(InsertTextFormat.PlainText)
      expect(divItem!.insertText).toBe("div")
    })

    it("works with extra spaces after <%=", () => {
      const labels = completionLabels("<%=  tag. %>", 0, 9)

      expect(labels).toContain("div")
      expect(labels).toContain("span")
    })

    it("works at end of line without closing tag", () => {
      const labels = completionLabels("<%= tag.", 0, 8)

      expect(labels).toContain("div")
    })

    it("works on second line", () => {
      const content = "<div>\n  <%= tag. %>\n</div>"
      const labels = completionLabels(content, 1, 10)

      expect(labels).toContain("div")
      expect(labels).toContain("span")
    })
  })

  describe("ActionView helper completions", () => {
    it("returns helpers after '<%='", () => {
      const labels = completionLabels("<%= ", 0, 4)

      expect(labels).toContain("tag")
      expect(labels).toContain("content_tag")
      expect(labels).toContain("link_to")
      expect(labels).toContain("turbo_frame_tag")
    })

    it("filters helpers by prefix", () => {
      const labels = completionLabels("<%= t", 0, 5)

      expect(labels).toContain("tag")
      expect(labels).toContain("turbo_frame_tag")
      expect(labels).not.toContain("link_to")
    })

    it("filters helpers with longer prefix", () => {
      const labels = completionLabels("<%= link", 0, 8)

      expect(labels).toContain("link_to")
      expect(labels).not.toContain("tag")
      expect(labels).not.toContain("content_tag")
    })

    it("returns completions with function kind", () => {
      const result = getCompletions("<%= l", 0, 5)

      expect(result).not.toBeNull()

      const linkToItem = result!.items.find(item => item.label === "link_to")
      expect(linkToItem).toBeDefined()
      expect(linkToItem!.kind).toBe(CompletionItemKind.Function)
    })

    it("includes signature as detail", () => {
      const result = getCompletions("<%= l", 0, 5)

      expect(result).not.toBeNull()

      const linkToItem = result!.items.find(item => item.label === "link_to")
      expect(linkToItem!.detail).toContain("link_to(")
    })

    it("includes documentation link", () => {
      const result = getCompletions("<%= l", 0, 5)

      expect(result).not.toBeNull()

      const linkToItem = result!.items.find(item => item.label === "link_to")
      const docs = linkToItem!.documentation as { kind: string; value: string }
      expect(docs.kind).toBe(MarkupKind.Markdown)
      expect(docs.value).toContain("https://")
    })

    it("uses sortText starting with ! for high priority", () => {
      const result = getCompletions("<%= ", 0, 4)

      expect(result).not.toBeNull()
      expect(result!.items.every(item => item.sortText!.startsWith("!"))).toBe(true)
    })

    it("preselects all helpers", () => {
      const result = getCompletions("<%= ", 0, 4)

      expect(result).not.toBeNull()
      expect(result!.items.every(item => item.preselect)).toBe(true)
    })

    it("returns null when no helpers match prefix", () => {
      const result = getCompletions("<%= xyz", 0, 7)

      expect(result).toBeNull()
    })

    it("works with extra spaces", () => {
      const labels = completionLabels("<%=   l", 0, 7)

      expect(labels).toContain("link_to")
    })
  })

  describe("content_tag : completions", () => {
    it("returns HTML tags as symbols after 'content_tag :'", () => {
      const result = getCompletions("<%= content_tag :", 0, 17)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThan(100)

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain(":div")
      expect(labels).toContain(":span")
      expect(labels).toContain(":p")
    })

    it("filters by prefix", () => {
      const labels = completionLabels("<%= content_tag :d", 0, 18)

      expect(labels).toContain(":div")
      expect(labels).toContain(":dl")
      expect(labels).not.toContain(":span")
    })

    it("returns correct detail", () => {
      const result = getCompletions("<%= content_tag :d", 0, 18)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === ":div")
      expect(divItem).toBeDefined()
      expect(divItem!.detail).toBe("content_tag :div — Generic container")
    })

    it("inserts tag name with trailing space when no space after cursor", () => {
      const result = getCompletions("<%= content_tag :d", 0, 18)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === ":div")
      expect(divItem!.insertText).toBe("div ")
    })

    it("inserts tag name without trailing space when space already exists", () => {
      const result = getCompletions("<%= content_tag : %>", 0, 17)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === ":div")
      expect(divItem!.insertText).toBe("div")
    })

    it("works with <% too", () => {
      const labels = completionLabels("<% content_tag :d", 0, 17)

      expect(labels).toContain(":div")
    })

    it("preselects common tags", () => {
      const result = getCompletions("<%= content_tag :", 0, 17)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === ":div")
      const datalistItem = result!.items.find(item => item.label === ":datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBe(false)
    })
  })

  describe("HTML open tag completions", () => {
    it("returns all HTML tags after '<'", () => {
      const result = getCompletions("<", 0, 1)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThan(100)

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("div")
      expect(labels).toContain("span")
      expect(labels).toContain("p")
    })

    it("filters by prefix", () => {
      const labels = completionLabels("<d", 0, 2)

      expect(labels).toContain("div")
      expect(labels).toContain("dl")
      expect(labels).not.toContain("span")
    })

    it("returns correct detail", () => {
      const result = getCompletions("<d", 0, 2)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem).toBeDefined()
      expect(divItem!.detail).toBe("<div> — Generic container")
    })

    it("uses snippet with closing tag for non-void tags", () => {
      const result = getCompletions("<d", 0, 2)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      expect(divItem!.insertTextFormat).toBe(InsertTextFormat.Snippet)
      expect(divItem!.insertText).toBe("div>$0</div>")
    })

    it("uses self-closing snippet for void tags", () => {
      const result = getCompletions("<b", 0, 2)

      expect(result).not.toBeNull()

      const brItem = result!.items.find(item => item.label === "br")
      expect(brItem!.insertTextFormat).toBe(InsertTextFormat.Snippet)
      expect(brItem!.insertText).toBe("br $0/>")
    })

    it("works after other content", () => {
      const labels = completionLabels("<div>hello</div>\n<s", 1, 2)

      expect(labels).toContain("span")
      expect(labels).toContain("section")
      expect(labels).toContain("select")
      expect(labels).not.toContain("div")
    })

    it("preselects common tags", () => {
      const result = getCompletions("<", 0, 1)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      const datalistItem = result!.items.find(item => item.label === "datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBe(false)
    })
  })

  describe("character reference completions", () => {
    it("returns character references after '&' in text content", () => {
      const result = getCompletions("<p>&</p>", 0, 4)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThan(0)

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("&amp;")
      expect(labels).toContain("&apos;")
    })

    it("filters by prefix", () => {
      const result = getCompletions("<p>&lt</p>", 0, 6)

      expect(result).not.toBeNull()

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("&lt;")
      expect(labels).not.toContain("&amp;")
      expect(labels).not.toContain("&gt;")
    })

    it("filters case-insensitively", () => {
      const result = getCompletions("<p>&AMP</p>", 0, 7)

      expect(result).not.toBeNull()

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("&AMP;")
      expect(labels).toContain("&amp;")
    })

    it("returns correct detail with character and codepoints", () => {
      const result = getCompletions("<p>&copy</p>", 0, 8)

      expect(result).not.toBeNull()

      const copyItem = result!.items.find(item => item.label === "&copy;")
      expect(copyItem).toBeDefined()
      expect(copyItem!.detail).toContain("`\u00A9`")
      expect(copyItem!.detail).toContain("U+00A9")
    })

    it("uses Value completion kind", () => {
      const result = getCompletions("<p>&amp</p>", 0, 7)

      expect(result).not.toBeNull()

      const ampItem = result!.items.find(item => item.label === "&amp;")
      expect(ampItem!.kind).toBe(CompletionItemKind.Value)
    })

    it("inserts name with semicolon", () => {
      const result = getCompletions("<p>&amp</p>", 0, 7)

      expect(result).not.toBeNull()

      const ampItem = result!.items.find(item => item.label === "&amp;")
      expect(ampItem!.insertText).toBe("amp;")
    })

    it("works in attribute values", () => {
      const result = getCompletions('<div data-value="&amp"></div>', 0, 21)

      expect(result).not.toBeNull()

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("&amp;")
    })

    it("filters in attribute values", () => {
      const result = getCompletions('<div data-value="&lt"></div>', 0, 20)

      expect(result).not.toBeNull()

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("&lt;")
      expect(labels).not.toContain("&amp;")
    })

    it("limits results to 100", () => {
      const result = getCompletions("<p>&</p>", 0, 4)

      expect(result).not.toBeNull()
      expect(result!.items.length).toBeLessThanOrEqual(100)
      expect(result!.isIncomplete).toBe(true)
    })

    it("includes documentation with markdown table", () => {
      const result = getCompletions("<p>&amp</p>", 0, 7)

      expect(result).not.toBeNull()

      const ampItem = result!.items.find(item => item.label === "&amp;")
      const documentation = ampItem!.documentation as { kind: string; value: string }
      expect(documentation.kind).toBe(MarkupKind.Markdown)
      expect(documentation.value).toContain("**Character**")
      expect(documentation.value).toContain("**Codepoints**")
      expect(documentation.value).toContain("**Reference**")
      expect(documentation.value).toContain("`&amp;`")
    })
  })

  describe("non-matching contexts", () => {
    it("returns null inside HTML content", () => {
      const result = getCompletions("<div>hello</div>", 0, 8)

      expect(result).toBeNull()
    })

    it("returns tag completions for <% tag.", () => {
      const labels = completionLabels("<% tag. %>", 0, 7)

      expect(labels).toContain("div")
      expect(labels).toContain("span")
    })

    it("returns helper completions for <%", () => {
      const labels = completionLabels("<% ", 0, 3)

      expect(labels).toContain("tag")
      expect(labels).toContain("content_tag")
    })

    it("returns null for plain text", () => {
      const result = getCompletions("just some text", 0, 5)

      expect(result).toBeNull()
    })

    it("returns helper completions for tag without dot", () => {
      const result = getCompletions("<%= tag %>", 0, 7)

      expect(result).not.toBeNull()

      const labels = result!.items.map(item => item.label)
      expect(labels).toContain("tag")
      expect(labels).not.toContain("div")
    })
  })
})
