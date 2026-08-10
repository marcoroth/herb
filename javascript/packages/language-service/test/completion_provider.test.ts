import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { CompletionItemKind, InsertTextFormat, MarkupKind, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

import { Herb } from "@herb-tools/node-wasm"
import { CompletionProvider } from "../src/completion_provider"
import { ParserService } from "@herb-tools/language-service"
import { buildPartialIndex } from "@herb-tools/linter/partial-index-builder"
import { relative } from "node:path"
import { fileURLToPath } from "node:url"


describe("CompletionProvider", () => {
  let service: CompletionProvider

  beforeAll(async () => {
    await Herb.load()
    const parserService = new ParserService(Herb)
    service = new CompletionProvider(parserService)
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
      expect(divItem!.detail).toBe("tag.div - Generic container")
    })

    it("preselects the common tag among the matches", () => {
      const result = getCompletions("<%= tag.d %>", 0, 9)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      const datalistItem = result!.items.find(item => item.label === "datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBeUndefined()
    })

    it("preselects at most one item", () => {
      const result = getCompletions("<%= tag. %>", 0, 8)

      expect(result).not.toBeNull()
      expect(result!.items.filter(item => item.preselect)).toHaveLength(1)
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

    it("works when the ERB tag spans multiple lines", () => {
      const content = "<%= link_to \"Home\",\n    tag.d %>"
      const labels = completionLabels(content, 1, 9)

      expect(labels).toContain("div")
      expect(labels).toContain("dialog")
      expect(labels).not.toContain("link_to")
      expect(labels).not.toContain("span")
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

    it("preselects at most one helper", () => {
      const result = getCompletions("<%= ", 0, 4)

      expect(result).not.toBeNull()
      expect(result!.items.filter(item => item.preselect)).toHaveLength(1)
    })

    it("returns null when no helpers match prefix", () => {
      const result = getCompletions("<%= xyz", 0, 7)

      expect(result).toBeNull()
    })

    it("works with extra spaces", () => {
      const labels = completionLabels("<%=   l", 0, 7)

      expect(labels).toContain("link_to")
    })

    it("applies the prefix when the ERB tag spans multiple lines", () => {
      const labels = completionLabels("<%=\n  link %>", 1, 6)

      expect(labels).toContain("link_to")
      expect(labels).not.toContain("tag")
      expect(labels).not.toContain("content_tag")
    })

    it("does not offer the same helper twice", () => {
      const labels = completionLabels("<%= a", 0, 5)

      expect(labels.length).toBeGreaterThan(0)
      expect(new Set(labels).size).toBe(labels.length)
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
      expect(divItem!.detail).toBe("content_tag :div - Generic container")
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

    it("preselects the common tag among the matches", () => {
      const result = getCompletions("<%= content_tag :d", 0, 18)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === ":div")
      const datalistItem = result!.items.find(item => item.label === ":datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBeUndefined()
    })

    it("preselects at most one item", () => {
      const result = getCompletions("<%= content_tag :", 0, 17)

      expect(result).not.toBeNull()
      expect(result!.items.filter(item => item.preselect)).toHaveLength(1)
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
      expect(divItem!.detail).toBe("<div> - Generic container")
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

    it("preselects the common tag among the matches", () => {
      const result = getCompletions("<d", 0, 2)

      expect(result).not.toBeNull()

      const divItem = result!.items.find(item => item.label === "div")
      const datalistItem = result!.items.find(item => item.label === "datalist")

      expect(divItem!.preselect).toBe(true)
      expect(datalistItem!.preselect).toBeUndefined()
    })

    it("preselects at most one item", () => {
      const result = getCompletions("<", 0, 1)

      expect(result).not.toBeNull()
      expect(result!.items.filter(item => item.preselect)).toHaveLength(1)
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

    it("returns helper completions for <% once a prefix is typed", () => {
      const labels = completionLabels("<% content_", 0, 11)

      expect(labels).toContain("content_tag")
      expect(labels).toContain("content_for")
    })

    it("returns null for a bare <% with nothing to filter on", () => {
      const result = getCompletions("<% ", 0, 3)

      expect(result).toBeNull()
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

  describe("partial name completions", () => {
    let partialService: CompletionProvider
    let root: string

    const FILES = {
      "app/views/posts/_card.html.erb": `<%# locals: (post:) %>\n`,
      "app/views/posts/_byline.html.erb": `<span></span>\n`,
      "app/views/posts/comments/_comment.html.erb": `<%# locals: (body:, author: nil) %>\n<p></p>\n`,
      "app/views/users/_avatar.html.erb": `<img>\n`,
      "app/views/application/_flash.html.erb": `<div></div>\n`,
      "app/views/_header.html.erb": `<header></header>\n`,
      "app/views/posts/index.html.erb": `<div></div>\n`,
      "app/views/posts/comments/index.html.erb": `<div></div>\n`,
    }

    beforeAll(async () => {
      root = mkdtempSync(join(tmpdir(), "herb-lsp-completion-"))

      for (const [path, contents] of Object.entries(FILES)) {
        const file = join(root, path)

        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, contents, "utf-8")
      }

      const partials = await buildPartialIndex(Herb, root)

      partialService = new CompletionProvider(new ParserService(Herb), partials, uri => {
        if (!uri.startsWith("file://")) return null

        const path = relative(root, fileURLToPath(uri))

        return path.startsWith("..") ? null : path
      })
    })

    afterAll(() => {
      rmSync(root, { recursive: true, force: true })
    })

    function completeIn(content: string, path = "app/views/posts/index.html.erb", anchor?: string) {
      const uri = pathToFileURL(join(root, path)).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const offset = anchor ? content.indexOf(anchor) + anchor.length : content.length

      return partialService.getCompletions(document, document.positionAt(offset))
    }

    function labelsIn(content: string, path?: string, anchor?: string): string[] {
      return (completeIn(content, path, anchor)?.items ?? []).map(item => item.label)
    }

    it("lists every partial inside `render partial: \"`", () => {
      expect(labelsIn(`<%= render partial: "`).sort()).toEqual([
        "application/flash",
        "header",
        "posts/byline",
        "posts/card",
        "posts/comments/comment",
        "users/avatar",
      ])
    })

    it("lists partials for a positional `render \"`", () => {
      expect(labelsIn(`<%= render "`)).toEqual([
        "posts/byline",
        "posts/card",
        "application/flash",
        "header",
        "posts/comments/comment",
        "users/avatar",
      ])
    })

    it("lists partials between the quotes of a closed positional call", () => {
      expect(labelsIn(`<%= render "" %>`, undefined, `render "`)).toContain("posts/card")
    })

    it("lists partials between the quotes of a closed keyword call", () => {
      expect(labelsIn(`<%= render partial: "" %>`, undefined, `partial: "`)).toContain("posts/card")
    })

    it("filters a positional `render \"` by a qualified prefix", () => {
      expect(labelsIn(`<%= render "posts/`)).toEqual([
        "posts/byline",
        "posts/card",
        "posts/comments/comment",
      ])
    })

    it("matches a positional `render \"` by a relative name", () => {
      expect(labelsIn(`<%= render "car`)).toEqual(["posts/card"])
    })

    it("supports a positional `render '` in single quotes", () => {
      expect(labelsIn(`<%= render 'car`)).toEqual(["posts/card"])
    })

    it("supports a positional `render(\"`", () => {
      expect(labelsIn(`<%= render("car`)).toEqual(["posts/card"])
    })

    it("does not complete a non-partial keyword such as `collection:`", () => {
      expect(labelsIn(`<%= render collection: "`)).toEqual([])
    })

    it("supports single quotes", () => {
      expect(labelsIn(`<%= render partial: '`)).toContain("posts/card")
    })

    it("supports a parenthesized call", () => {
      expect(labelsIn(`<%= render(partial: "`)).toContain("posts/card")
    })

    it("supports the hash rocket form", () => {
      expect(labelsIn(`<%= render :partial => "`)).toContain("posts/card")
    })

    it("supports `layout:`", () => {
      expect(labelsIn(`<%= render layout: "`)).toContain("posts/card")
    })

    it("supports `spacer_template:` later in the argument list", () => {
      expect(labelsIn(`<%= render partial: "posts/card", collection: @posts, spacer_template: "`)).toContain("posts/byline")
    })

    it("supports `layout:` later in the argument list", () => {
      expect(labelsIn(`<%= render partial: "posts/card", layout: "`)).toContain("posts/byline")
    })

    it("supports a keyword split across lines", () => {
      expect(labelsIn(`<%= render partial: "posts/card",\n      spacer_template: "`)).toContain("posts/byline")
    })

    it("does not complete inside a `locals:` hash value", () => {
      expect(labelsIn(`<%= render partial: "posts/card", locals: { title: "`)).toEqual([])
    })

    it("does not prefill locals when completing a `spacer_template:`", () => {
      const content = `<%= render partial: "posts/card", spacer_template: "card" %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.lastIndexOf(`card"`) + 4))!.items

      expect(item.textEdit).toHaveProperty("newText", "posts/card")
    })

    it("filters by a qualified prefix", () => {
      expect(labelsIn(`<%= render partial: "users/`)).toEqual(["users/avatar"])
    })

    it("matches a partial in the same directory by its relative name", () => {
      expect(labelsIn(`<%= render partial: "car`)).toEqual(["posts/card"])
    })

    it("matches an `application/` partial by its relative name", () => {
      expect(labelsIn(`<%= render partial: "fla`)).toEqual(["application/flash"])
    })

    it("ranks partials in the same directory ahead of the rest", () => {
      expect(labelsIn(`<%= render partial: "`)).toEqual([
        "posts/byline",
        "posts/card",
        "application/flash",
        "header",
        "posts/comments/comment",
        "users/avatar",
      ])
    })

    it("ranks by how far the partial sits from the current file", () => {
      expect(labelsIn(`<%= render partial: "`, "app/views/posts/comments/index.html.erb")).toEqual([
        "posts/comments/comment",
        "application/flash",
        "posts/byline",
        "posts/card",
        "header",
        "users/avatar",
      ])
    })

    it("inserts the fully qualified name over a relative prefix", () => {
      const content = `<%= render partial: "byl" %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(`byl"`) + 3))!.items

      expect(item.textEdit).toEqual({
        range: {
          start: { line: 0, character: content.indexOf("byl") },
          end: { line: 0, character: content.indexOf(`" %>`) },
        },
        newText: "posts/byline",
      })
    })

    it("prefills required locals as tab stops for the `partial:` form", () => {
      const content = `<%= render partial: "card" %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(`card"`) + 4))!.items

      expect(item.insertTextFormat).toBe(InsertTextFormat.Snippet)
      expect(item.textEdit).toEqual({
        range: {
          start: { line: 0, character: content.indexOf("card") },
          end: { line: 0, character: content.indexOf(`" %>`) + 1 },
        },
        newText: `posts/card", locals: { post: \${1:post} }$0`,
      })
    })

    it("spells out `partial:` when completing the positional form", () => {
      expect(applyFirst(`<%= render "card" %>`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} }$0 %>`)
    })

    it("spells out `partial:` even when the partial has no required locals", () => {
      expect(applyFirst(`<%= render "byl" %>`, "byl")).toBe(`<%= render partial: "posts/byline" %>`)
    })

    it("leaves the positional form alone when other arguments follow", () => {
      expect(applyFirst(`<%= render "card", post: @post %>`)).toBe(`<%= render "posts/card", post: @post %>`)
    })

    it("leaves bare locals unwrapped when completing into an empty name", () => {
      expect(applyFirst(`<%= render "", posts: @posts %>`, `render "`)).toBe(`<%= render "posts/byline", posts: @posts %>`)
    })

    describe("render keywords", () => {
      it("expands the `render` helper straight into a partial call", () => {
        const [item] = (completeIn(`<%= ren %>`, undefined, `<%= ren`)?.items ?? []).filter(candidate => candidate.label === "render")

        expect(item.insertTextFormat).toBe(InsertTextFormat.Snippet)
        expect(item.insertText).toBe(`render partial: "$0"`)
        expect(item.command).toEqual({ title: "Suggest", command: "editor.action.triggerSuggest" })
      })

      it("closes the ERB tag when expanding `render` into an unterminated tag", () => {
        const [item] = (completeIn(`<%= ren`)?.items ?? []).filter(candidate => candidate.label === "render")

        expect(item.insertText).toBe(`render partial: "$0" %>`)
      })

      it("leaves other helpers as plain text", () => {
        const [item] = (completeIn(`<%= link_t`)?.items ?? []).filter(candidate => candidate.label === "link_to")

        expect(item.insertTextFormat).toBe(InsertTextFormat.PlainText)
        expect(item.insertText).toBe("link_to")
      })

      it("offers every render option Action View accepts in a view", () => {
        expect(labelsIn(`<%= render `).sort()).toEqual([
          "as",
          "body",
          "cached",
          "collection",
          "file",
          "formats",
          "handlers",
          "html",
          "inline",
          "layout",
          "locals",
          "object",
          "partial",
          "plain",
          "renderable",
          "spacer_template",
          "template",
          "variants",
        ])
      })

      it("gives every option a value shaped like its type", () => {
        const expected: Record<string, string> = {
          partial: `partial: "$0"`,
          template: `template: "$0"`,
          layout: `layout: "$0"`,
          spacer_template: `spacer_template: "$0"`,
          file: `file: "$0"`,
          inline: `inline: "$0"`,
          plain: `plain: "$0"`,
          html: `html: "$0"`,
          body: `body: "$0"`,
          collection: `collection: \${1:[]}`,
          formats: `formats: \${1:[]}`,
          variants: `variants: \${1:[]}`,
          handlers: `handlers: \${1:[]}`,
          object: `object: \${1:nil}`,
          renderable: `renderable: \${1:nil}`,
          as: `as: :$0`,
          cached: `cached: $0`,
          locals: `locals: { $0 }`,
        }

        const snippets = Object.fromEntries(
          (completeIn(`<%= render `)?.items ?? []).map(item => [item.label, (item.textEdit as { newText: string }).newText])
        )

        expect(snippets).toEqual(expected)
      })

      it("sorts render suggestions ahead of the general purpose ones", () => {
        const insideRender = (completeIn(`<%= render `)?.items ?? []).map(item => item.sortText!)
        const [helper] = (completeIn(`<%= link_t`)?.items ?? []).map(item => item.sortText!)

        expect(insideRender.every(sortText => sortText < helper)).toBe(true)
      })

      it("offers locals rather than render options in the shorthand form", () => {
        const labels = labelsIn(`<%= render "posts/comments/comment", `)

        expect(labels).toEqual(["body", "author"])
        expect(labels).not.toContain("collection")
      })

      it("offers variables for any shorthand local's value", () => {
        const content = `<% @body = 1 %>\n<%= render "posts/comments/comment", body: `

        expect(labelsIn(content)).toContain("@body")
      })

      it("still offers render options once `partial:` names the partial", () => {
        expect(labelsIn(`<%= render partial: "posts/comments/comment", `)).toContain("collection")
      })

      it("offers the render options after a comma", () => {
        const labels = labelsIn(`<%= render partial: "posts/card", `)

        expect(labels).toContain("collection")
        expect(labels).toContain("spacer_template")
        expect(labels).toContain("locals")
        expect(labels).toContain("as")
        expect(labels).toContain("cached")
      })

      it("offers the render options after a trailing comma before `%>`", () => {
        const content = `<%= render partial: "browse/kind_row", %>`
        const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
        const document = TextDocument.create(uri, "erb", 1, content)
        const labels = (partialService.getCompletions(document, document.positionAt(content.indexOf(`, %>`) + 2))?.items ?? []).map(item => item.label)

        expect(labels).toContain("collection")
        expect(labels).toContain("locals")
      })

      it("offers the render options directly after `render`", () => {
        expect(labelsIn(`<%= render `)).toContain("partial")
      })

      it("does not offer a keyword that is already written", () => {
        const labels = labelsIn(`<%= render partial: "posts/card", collection: @posts, `)

        expect(labels).not.toContain("partial")
        expect(labels).not.toContain("collection")
        expect(labels).toContain("spacer_template")
      })

      it("filters the options by prefix", () => {
        expect(labelsIn(`<%= render partial: "posts/card", spa`)).toEqual(["spacer_template"])
      })

      it("expands `locals` into an empty hash", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", loc`)!.items

        expect(item.textEdit).toHaveProperty("newText", "locals: { $0 }")
      })

      it("expands an option with no known shape to a bare keyword", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", cach`)!.items

        expect(item.textEdit).toHaveProperty("newText", "cached: $0")
      })

      it("expands `object` to a selectable nil", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", obj`)!.items

        expect(item.textEdit).toHaveProperty("newText", `object: \${1:nil}`)
      })

      it("expands a symbol option with a leading colon", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", as`)!.items

        expect(item.label).toBe("as")
        expect(item.textEdit).toHaveProperty("newText", "as: :$0")
      })

      it("expands `collection` to a selectable empty array", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", collec`)!.items

        expect(item.insertTextFormat).toBe(InsertTextFormat.Snippet)
        expect(item.textEdit).toHaveProperty("newText", `collection: \${1:[]}`)
      })

      it("expands every array option the same way", () => {
        for (const [typed, label] of [["form", "formats"], ["vari", "variants"], ["hand", "handlers"]]) {
          const [item] = completeIn(`<%= render partial: "posts/card", ${typed}`)!.items

          expect([label, item.label]).toEqual([label, label])
          expect(item.textEdit).toHaveProperty("newText", `${label}: \${1:[]}`)
        }
      })

      it("puts the cursor between the quotes of a string option", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", tem`)!.items

        expect(item.textEdit).toHaveProperty("newText", `template: "$0"`)
      })

      it("expands a string option with the quotes and the cursor between them", () => {
        const [item] = completeIn(`<%= render par`)!.items

        expect(item.label).toBe("partial")
        expect(item.textEdit).toHaveProperty("newText", `partial: "$0"`)
      })

      it("expands `spacer_template` with quotes too", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", spa`)!.items

        expect(item.textEdit).toHaveProperty("newText", `spacer_template: "$0"`)
      })

      it("reopens the suggestions after an option that has a list", () => {
        for (const [typed, label] of [["par", "partial"], ["lay", "layout"], ["spa", "spacer_template"], ["loc", "locals"]]) {
          const [item] = completeIn(`<%= render ${typed}`)!.items

          expect([label, item.label]).toEqual([label, label])
          expect(item.command).toEqual({ title: "Suggest", command: "editor.action.triggerSuggest" })
        }
      })

      it("does not reopen the suggestions for an option with nothing to list", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", collec`)!.items

        expect(item.command).toBeUndefined()
      })

      it("offers the partial list once the quotes are in place", () => {
        expect(labelsIn(`<%= render partial: "`)).toContain("posts/card")
      })

      it("documents the option", () => {
        const [item] = completeIn(`<%= render partial: "posts/card", spa`)!.items

        expect(item.detail).toBe("string")
        expect(item.documentation).toEqual({
          kind: MarkupKind.Markdown,
          value: "Partial rendered between the items of a collection.",
        })
      })

      it("offers nothing inside an unterminated string argument", () => {
        expect(labelsIn(`<%= render partial: "posts/card", spacer_template: "unclosed`)).not.toContain("collection")
      })
    })

    describe("strict locals", () => {
      it("offers the strict locals of the rendered partial", () => {
        expect(labelsIn(`<%= render partial: "posts/comments/comment", locals: { `)).toEqual(["body", "author"])
      })

      it("offers them for the positional form too", () => {
        expect(labelsIn(`<%= render "posts/comments/comment", locals: { `)).toEqual(["body", "author"])
      })

      it("does not offer a local that is already passed", () => {
        expect(labelsIn(`<%= render partial: "posts/comments/comment", locals: { body: @body, `)).toEqual(["author"])
      })

      it("filters the locals by prefix", () => {
        expect(labelsIn(`<%= render partial: "posts/comments/comment", locals: { aut`)).toEqual(["author"])
      })

      it("marks whether the local is required", () => {
        const items = completeIn(`<%= render partial: "posts/comments/comment", locals: { `)!.items

        expect(items.map(item => [item.label, item.detail])).toEqual([["body", "required"], ["author", "optional"]])
      })

      it("inserts the local as a tab stop", () => {
        const [item] = completeIn(`<%= render partial: "posts/comments/comment", locals: { aut`)!.items

        expect(item.textEdit).toHaveProperty("newText", `author: \${1:author}$0`)
      })

      it("offers nothing when the partial declares no strict locals", () => {
        expect(completeIn(`<%= render partial: "posts/byline", locals: { `)).toBeNull()
      })

      it("offers nothing when the partial cannot be resolved", () => {
        expect(completeIn(`<%= render partial: "nope/missing", locals: { `)).toBeNull()
      })

      it("does not offer render options inside the locals hash", () => {
        expect(labelsIn(`<%= render partial: "posts/comments/comment", locals: { `)).not.toContain("collection")
      })

      it("offers the template's variables as a local's value", () => {
        const content = `<% @posts.each do |post| %>\n<%= render partial: "posts/comments/comment", locals: { body: `
        const labels = labelsIn(content)

        expect(labels).toContain("@posts")
        expect(labels).toContain("post")
      })

      it("ranks the variable that matches the local being assigned first", () => {
        const content = `<% @body = 1 %>\n<% other = 2 %>\n<%= render partial: "posts/comments/comment", locals: { body: `

        expect(labelsIn(content)[0]).toBe("@body")
      })

      it("filters the variables by prefix", () => {
        const content = `<% @posts = 1 %>\n<% author = 2 %>\n<%= render partial: "posts/comments/comment", locals: { body: @po`

        expect(labelsIn(content)).toEqual(["@posts"])
      })

      it("labels instance variables and locals distinctly", () => {
        const content = `<% @posts.each do |post| %>\n<%= render partial: "posts/comments/comment", locals: { body: `
        const items = completeIn(content)!.items
        const kinds = Object.fromEntries(items.map(item => [item.label, item.detail]))

        expect(kinds["@posts"]).toBe("instance variable")
        expect(kinds["post"]).toBe("local variable")
      })

      it("offers variables for `collection:` too", () => {
        const content = `<% @posts = 1 %>\n<%= render partial: "posts/card", collection: `

        expect(labelsIn(content)).toContain("@posts")
      })

      it("does not offer variables for a string option", () => {
        const content = `<% @posts = 1 %>\n<%= render partial: "posts/card", template: `

        expect(labelsIn(content)).not.toContain("@posts")
      })

      it("reopens the suggestions on the tab stop a strict local inserts", () => {
        const [item] = completeIn(`<%= render partial: "posts/comments/comment", locals: { bod`)!.items

        expect(item.textEdit).toHaveProperty("newText", `body: \${1:body}$0`)
        expect(item.command).toEqual({ title: "Suggest", command: "editor.action.triggerSuggest" })
      })

      it("offers the matching instance variable on the tab stop the prefill leaves selected", () => {
        const content = `<% @body = 1 %>\n<%= render partial: "posts/comments/comment", locals: { body: body`

        expect(labelsIn(content)).toEqual(["@body"])
      })

      it("matches an instance variable from a prefix without the sigil", () => {
        const content = `<% @body = 1 %>\n<% @other = 2 %>\n<%= render partial: "posts/comments/comment", locals: { body: bod`

        expect(labelsIn(content)).toEqual(["@body"])
      })

      it("brings its own space when the cursor sits right after the colon", () => {
        const content = `<% @user = 1 %>\n<%= render partial: "users/card", locals: { user: } %>`
        const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
        const document = TextDocument.create(uri, "erb", 1, content)
        const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf("user: }") + 5))!.items

        expect(item.textEdit).toHaveProperty("newText", " @user")
      })

      it("does not double the space when one is already there", () => {
        const content = `<% @user = 1 %>\n<%= render partial: "users/card", locals: { user: } %>`
        const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
        const document = TextDocument.create(uri, "erb", 1, content)
        const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf("user: }") + 6))!.items

        expect(item.textEdit).toHaveProperty("newText", "@user")
      })

      it("offers instance variables from a bare `@`", () => {
        const content = `<% @user = 1 %>\n<% other = 2 %>\n<%= render partial: "users/card", locals: { user: @`

        expect(labelsIn(content)).toEqual(["@user"])
      })

      it("spaces a strict local inserted right after a comma", () => {
        const [item] = completeIn(`<%= render partial: "posts/comments/comment", locals: { body: @b,`)!.items

        expect(item.textEdit).toHaveProperty("newText", ` author: \${1:author}$0`)
      })

      it("spaces a render keyword inserted right after a comma", () => {
        const [item] = completeIn(`<%= render partial: "posts/card",`)!.items

        expect((item.textEdit as { newText: string }).newText.startsWith(" ")).toBe(true)
      })

      it("offers nothing inside a local's string value", () => {
        expect(completeIn(`<%= render partial: "posts/comments/comment", locals: { body: "unclosed`)).toBeNull()
      })

      it("offers nothing inside a nested hash value", () => {
        expect(completeIn(`<%= render partial: "posts/comments/comment", locals: { body: { nested: `)).toBeNull()
      })
    })

    it("offers nothing inside a `render ... do` block, which is not supported yet", () => {
      const content = `<%= render "card" do %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)

      expect(partialService.getCompletions(document, document.positionAt(content.indexOf(`card"`) + 4))).toBeNull()
    })

    it("does not rewrite `layout:` into `partial:`", () => {
      expect(applyFirst(`<%= render layout: "card" %>`)).toBe(`<%= render layout: "posts/card", locals: { post: \${1:post} }$0 %>`)
    })

    it("keeps the hash rocket form as written", () => {
      expect(applyFirst(`<%= render :partial => "card" %>`)).toBe(`<%= render :partial => "posts/card", locals: { post: \${1:post} }$0 %>`)
    })

    it("completes the closing quote when the string is still open", () => {
      const content = `<%= render partial: "card %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(" %>")))!.items

      expect(item.textEdit).toHaveProperty("newText", `posts/card", locals: { post: \${1:post} }$0`)
    })

    function applyFirst(content: string, typed = "card"): string {
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const position = document.positionAt(content.indexOf(typed) + typed.length)
      const [item] = partialService.getCompletions(document, position)!.items
      const edit = item.textEdit as { range: Range, newText: string }

      return content.slice(0, document.offsetAt(edit.range.start)) + edit.newText + content.slice(document.offsetAt(edit.range.end))
    }

    it("keeps a space before `%>` when nothing separates it from the name", () => {
      expect(applyFirst(`<%= render partial: "card"%>`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} } $0%>`)
    })

    it("does not add a second space when one already precedes `%>`", () => {
      expect(applyFirst(`<%= render partial: "card" %>`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} }$0 %>`)
    })

    it("closes an unterminated ERB tag", () => {
      expect(applyFirst(`<%= render partial: "card`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} } $0%>`)
    })

    it("closes an unterminated ERB tag for the positional form", () => {
      expect(applyFirst(`<%= render "card`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} } $0%>`)
    })

    it("closes an unterminated ERB tag for a partial with no required locals", () => {
      expect(applyFirst(`<%= render partial: "byl`, "byl")).toBe(`<%= render partial: "posts/byline" $0%>`)
    })

    it("closes an unterminated ERB tag without swallowing the lines below it", () => {
      expect(applyFirst(`<div>\n  <%= render "card\n</div>`)).toBe(`<div>\n  <%= render partial: "posts/card", locals: { post: \${1:post} } $0%>\n</div>`)
    })

    it("does not add a second `%>` when the tag closes on a later line", () => {
      expect(applyFirst(`<%= render partial: "card"\n%>`)).toBe(`<%= render partial: "posts/card", locals: { post: \${1:post} }$0\n%>`)
    })

    it("leaves locals written for another partial untouched", () => {
      const content = `<%= render partial: "posts/comments/com", locals: { layers: user } %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(`com"`) + 3))!.items
      const edit = item.textEdit as { range: Range, newText: string }
      const applied = content.slice(0, document.offsetAt(edit.range.start)) + edit.newText + content.slice(document.offsetAt(edit.range.end))

      expect(applied).toBe(`<%= render partial: "posts/comments/comment", locals: { layers: user } %>`)
    })

    it("leaves an already closed tag with arguments untouched", () => {
      expect(applyFirst(`<%= render partial: "card", locals: { post: @post } %>`)).toBe(`<%= render partial: "posts/card", locals: { post: @post } %>`)
    })

    it("does not prefill locals when the partial has none required", () => {
      const content = `<%= render partial: "byline" %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(`" %>`)))!.items

      expect(item.insertTextFormat).toBe(InsertTextFormat.PlainText)
      expect(item.textEdit).toHaveProperty("newText", "posts/byline")
    })

    it("does not prefill locals when the call already passes arguments", () => {
      const content = `<%= render partial: "card", locals: { post: @post } %>`
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const document = TextDocument.create(uri, "erb", 1, content)
      const [item] = partialService.getCompletions(document, document.positionAt(content.indexOf(`card"`) + 4))!.items

      expect(item.textEdit).toHaveProperty("newText", "posts/card")
    })

    it("documents the strict locals of the partial", () => {
      const item = completeIn(`<%= render partial: "posts/card`)!.items[0]

      expect(item.documentation).toEqual({
        kind: MarkupKind.Markdown,
        value: "```erb\n<%# locals: (post:) %>\n```",
      })
    })

    it("reports the partial's file as the detail", () => {
      const item = completeIn(`<%= render partial: "posts/card`)!.items[0]

      expect(item.detail).toBe("app/views/posts/_card.html.erb")
    })

    it("does not complete once the partial name is closed", () => {
      expect(completeIn(`<%= render partial: "posts/card"`)).toBeNull()
    })

    it("does not complete in a later string argument", () => {
      expect(labelsIn(`<%= render partial: "posts/card", locals: { title: "`)).toEqual([])
    })

    it("returns nothing when no partial index is available", () => {
      const uri = pathToFileURL(join(root, "app/views/posts/index.html.erb")).toString()
      const content = `<%= render partial: "`
      const document = TextDocument.create(uri, "erb", 1, content)

      expect(service.getCompletions(document, document.positionAt(content.length))).toBeNull()
    })
  })

  describe("block arguments", () => {
    let actionViewService: CompletionProvider

    beforeAll(() => {
      actionViewService = new CompletionProvider(new ParserService(Herb))
      actionViewService.setFramework("actionview")
    })

    function labelsFor(content: string): string[] {
      const document = createDocument(content)
      const result = actionViewService.getCompletions(document, Position.create(0, content.length))

      return result ? result.items.map(item => item.label) : []
    }

    it("offers the arguments a helper yields, with the pipes", () => {
      expect(labelsFor("<%= form_with model: @user do ")).toContain("|form|")
    })

    it("drops the pipes once the user has started them", () => {
      expect(labelsFor("<%= form_with model: @user do |")).toContain("form")
    })

    it("stays quiet for a call that yields nothing", () => {
      expect(labelsFor("<% cache @post do ")).toEqual([])
    })

    it("stays quiet when the project isn't an Action View project", () => {
      const document = createDocument("<%= form_with model: @user do ")
      const result = service.getCompletions(document, Position.create(0, 29))

      expect(result ? result.items.map(item => item.label) : []).not.toContain("|form|")
    })
  })
})
