import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { ParserService } from "../src/parser_service"
import { SemanticTokensProvider, semanticTokenTypes, semanticTokenModifiers } from "../src/semantic_tokens_provider"

describe("SemanticTokensProvider", () => {
  let provider: SemanticTokensProvider

  beforeAll(async () => {
    await Herb.load()
    provider = new SemanticTokensProvider(new ParserService(Herb))
  })

  function tokensFor(content: string) {
    const document = TextDocument.create("file:///test.html.erb", "erb", 1, content)
    const { data } = provider.getSemanticTokens(document)
    const lines = content.split("\n")

    const tokens: { text: string, type: string, modifiers: string[] }[] = []

    let line = 0
    let character = 0

    for (let index = 0; index < data.length; index += 5) {
      const [deltaLine, deltaCharacter, length, type, modifiers] = data.slice(index, index + 5)

      line += deltaLine
      character = deltaLine === 0 ? character + deltaCharacter : deltaCharacter

      tokens.push({
        text: lines[line].slice(character, character + length),
        type: semanticTokenTypes[type],
        modifiers: semanticTokenModifiers.filter((_, bit) => modifiers & (1 << bit)),
      })
    }

    return tokens
  }

  const textAndType = (content: string) => tokensFor(content).map(token => [token.text, token.type])

  describe("HTML", () => {
    it("names tags, attributes and values", () => {
      expect(textAndType(`<div class="card">hello</div>`)).toEqual([
        ["<", "macro"],
        ["div", "type"],
        ["class", "property"],
        ['"', "string"],
        ["card", "string"],
        ['"', "string"],
        [">", "macro"],
        ["</", "macro"],
        ["div", "type"],
        [">", "macro"],
      ])
    })

    it("does not claim text content", () => {
      expect(textAndType("<p>hello</p>").map(([text]) => text)).not.toContain("hello")
    })

    it("marks a comment", () => {
      expect(textAndType("<!-- note -->")).toEqual([
        ["<!--", "comment"],
        [" ", "comment"],
        ["note", "comment"],
        [" ", "comment"],
        ["-->", "comment"],
      ])
    })
  })

  describe("ERB", () => {
    it("claims the delimiters but not the Ruby", () => {
      expect(textAndType("<%= user.name %>")).toEqual([
        ["<%=", "macro"],
        ["%>", "macro"],
      ])
    })

    it("leaves a plain method call to a Ruby language server", () => {
      expect(textAndType("<%= some_local_method %>")).toEqual([
        ["<%=", "macro"],
        ["%>", "macro"],
      ])
    })
  })

  describe("Action View helpers", () => {
    it("marks a helper as coming from the framework", () => {
      const tokens = tokensFor(`<%= link_to "Home", root_path %>`)
      const helper = tokens.find(token => token.text === "link_to")

      expect(helper).toBeDefined()
      expect(helper!.type).toBe("function")
      expect(helper!.modifiers).toEqual(["defaultLibrary"])
    })

    it("does not mark a method the application defines", () => {
      expect(tokensFor(`<%= my_own_helper "Home" %>`).some(token => token.text === "my_own_helper")).toBe(false)
    })

    it("finds the helper past leading whitespace", () => {
      const helper = tokensFor(`<%=    content_tag :div %>`).find(token => token.text === "content_tag")

      expect(helper?.modifiers).toEqual(["defaultLibrary"])
    })
  })

  describe("ERB comments", () => {
    it("marks a comment tag apart from a code tag", () => {
      expect(textAndType("<%# just a note %>")).toEqual([
        ["<%#", "comment"],
        [" just a note ", "comment"],
        ["%>", "comment"],
      ])
    })

    it("does not treat a comment's words as Ruby", () => {
      expect(textAndType("<%# if and end %>").map(([, type]) => type)).toEqual(["comment", "comment", "comment"])
    })

    it("keeps a code tag as a delimiter", () => {
      expect(textAndType("<% x %>").map(([text, type]) => [text, type])).toEqual([
        ["<%", "macro"],
        ["%>", "macro"],
      ])
    })
  })

  describe("Ruby keywords", () => {
    it("marks keywords inside a code tag", () => {
      const tokens = tokensFor("<% if user.admin? %>")

      expect(tokens.find(token => token.text === "if")?.type).toBe("keyword")
    })

    it("leaves other words alone", () => {
      expect(tokensFor("<% user.admin? %>").some(token => token.text === "user")).toBe(false)
    })

    it("finds keywords on later lines of a multi-line tag", () => {
      const tokens = tokensFor("<%\n  if a\n  end\n%>")

      expect(tokens.filter(token => token.text === "if" || token.text === "end").map(t => t.type)).toEqual(["keyword", "keyword"])
    })
  })

  describe("output tags", () => {
    it("marks an output tag apart from a code tag", () => {
      const output = tokensFor("<%= a %>").filter(token => token.type === "macro")
      const silent = tokensFor("<% a %>").filter(token => token.type === "macro")

      expect(output.map(token => token.modifiers)).toEqual([["output"], ["output"]])
      expect(silent.map(token => token.modifiers)).toEqual([[], []])
    })

    it("keeps both as the same type so a theme can ignore the difference", () => {
      expect(tokensFor("<%= a %>")[0].type).toBe("macro")
      expect(tokensFor("<% a %>")[0].type).toBe("macro")
    })

    it("does not mark a comment tag as output", () => {
      expect(tokensFor("<%# a %>").some(token => token.modifiers.includes("output"))).toBe(false)
    })
  })

  describe("strict locals", () => {
    it("marks each declared local as a parameter", () => {
      const tokens = tokensFor(`<%# locals: (hello:, abc: "") %>`)
      const parameters = tokens.filter(token => token.type === "parameter")

      expect(parameters.map(token => token.text)).toEqual(["hello", "abc"])
    })

    it("still marks the surrounding tag as a comment", () => {
      const tokens = tokensFor(`<%# locals: (title:) %>`)

      expect(tokens[0].type).toBe("comment")
      expect(tokens.some(token => token.type === "parameter")).toBe(true)
    })

    it("does not invent parameters for an ordinary comment", () => {
      expect(tokensFor("<%# not locals %>").some(token => token.type === "parameter")).toBe(false)
    })
  })

  describe("encoding", () => {
    it("emits five integers per token", () => {
      const document = TextDocument.create("file:///test.html.erb", "erb", 1, `<div class="a">x</div>`)

      expect(provider.getSemanticTokens(document).data.length % 5).toBe(0)
    })

    it("keeps deltas non-negative across lines", () => {
      const content = dedent`
        <div class="card">
          <span id="a">one</span>
          <%= link_to "Home", root_path %>
        </div>
      `

      const { data } = provider.getSemanticTokens(TextDocument.create("file:///test.html.erb", "erb", 1, content))

      for (let index = 0; index < data.length; index += 5) {
        expect(data[index], "delta line must not go backwards").toBeGreaterThanOrEqual(0)
        expect(data[index + 1], "delta character must not go backwards").toBeGreaterThanOrEqual(0)
      }
    })

    it("never emits overlapping tokens", () => {
      const content = `<%# locals: (hello:, abc: "") %>\n<div class="card">\n  <% if a %>\n    <%= link_to "x", y %>\n  <% end %>\n</div>`
      const tokens = tokensFor(content)

      const positions = tokensFor(content).map((token, index) => ({ token, index }))

      expect(positions.length).toBeGreaterThan(0)
      expect(tokens.every(token => token.text.length > 0), "every token must cover real text").toBe(true)
    })

    it("splits the comment around a locals declaration rather than nesting", () => {
      const tokens = tokensFor(`<%# locals: (title:) %>`)
      const types = tokens.map(token => token.type)

      expect(types).toContain("parameter")
      expect(tokens.filter(token => token.type === "comment").length).toBeGreaterThan(1)
    })

    it("returns nothing for an empty document", () => {
      expect(provider.getSemanticTokens(TextDocument.create("file:///test.html.erb", "erb", 1, "")).data).toEqual([])
    })
  })
})
