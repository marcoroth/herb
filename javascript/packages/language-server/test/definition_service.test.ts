import { describe, it, expect, beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { DefinitionService } from "../src/definition_service"
import { ParserService } from "../src/parser_service"

const VIEW_URI = "file:///project/app/views/events/show.html.erb"

describe("DefinitionService", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function createService(...files: string[]) {
    const existing = new Set(files)

    return new DefinitionService(parserService, filePath => existing.has(filePath))
  }

  function definitions(service: DefinitionService, content: string, target: string, uri = VIEW_URI) {
    const document = TextDocument.create(uri, "erb", 1, content)
    const position = document.positionAt(content.indexOf(target) + 1)

    return service.getDefinition(document, position)
  }

  function uris(service: DefinitionService, content: string, target: string, uri = VIEW_URI) {
    return definitions(service, content, target, uri).map(link => link.targetUri)
  }

  function selection(service: DefinitionService, content: string, target: string, uri = VIEW_URI) {
    const document = TextDocument.create(uri, "erb", 1, content)
    const [link] = definitions(service, content, target, uri)

    return document.getText(link.originSelectionRange)
  }

  describe("qualified partial names", () => {
    it("resolves a partial relative to app/views", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home", locals: { event: event } %>`

      expect(uris(service, content, "events/featured_home")).toEqual([
        "file:///project/app/views/events/_featured_home.html.erb"
      ])
    })

    it("resolves from a template in a different directory", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home" %>`

      expect(uris(service, content, "events/featured_home", "file:///project/app/views/home/index.html.erb")).toEqual([
        "file:///project/app/views/events/_featured_home.html.erb"
      ])
    })

    it("resolves a deeply nested partial", () => {
      const service = createService("/project/app/views/admin/users/_row.html.erb")
      const content = `<%= render partial: "admin/users/row" %>`

      expect(uris(service, content, "admin/users/row")).toEqual([
        "file:///project/app/views/admin/users/_row.html.erb"
      ])
    })

    it("resolves the shorthand render form", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render "events/featured_home", event: event %>`

      expect(uris(service, content, "events/featured_home")).toHaveLength(1)
    })

    it("resolves the parenthesized form", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render(partial: "events/featured_home") %>`

      expect(uris(service, content, "events/featured_home")).toHaveLength(1)
    })

    it("points at the start of the partial", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home" %>`
      const [link] = definitions(service, content, "events/featured_home")

      expect(link.targetRange).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 0 } })
      expect(link.targetSelectionRange).toEqual(link.targetRange)
    })

    it("underlines the whole partial name, without the quotes", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home", locals: { event: event } %>`

      expect(selection(service, content, "featured_home")).toBe("events/featured_home")
      expect(selection(service, content, "events/")).toBe("events/featured_home")
    })

    it("underlines the whole name for the shorthand form", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render "events/featured_home" %>`

      expect(selection(service, content, "featured_home")).toBe("events/featured_home")
    })

    it("resolves when the cursor is on the partial keyword", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home" %>`

      expect(uris(service, content, "partial:")).toEqual([
        "file:///project/app/views/events/_featured_home.html.erb"
      ])

      expect(selection(service, content, "partial:")).toBe("events/featured_home")
    })

    it("does not resolve from a different keyword", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home", locals: { event: event } %>`

      expect(definitions(service, content, "locals:")).toEqual([])
    })
  })

  describe("unqualified partial names", () => {
    it("resolves next to the current template", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = `<%= render partial: "card" %>`

      expect(uris(service, content, `"card"`)).toEqual([
        "file:///project/app/views/events/_card.html.erb"
      ])
    })

    it("falls back to app/views/application", () => {
      const service = createService("/project/app/views/application/_card.html.erb")
      const content = `<%= render partial: "card" %>`

      expect(uris(service, content, `"card"`)).toEqual([
        "file:///project/app/views/application/_card.html.erb"
      ])
    })
  })

  describe("template extensions", () => {
    it("finds a partial with the extension of the current template", () => {
      const service = createService("/project/app/views/events/_card.turbo_stream.erb")
      const content = `<%= render partial: "card" %>`

      expect(uris(service, content, `"card"`, "file:///project/app/views/events/index.turbo_stream.erb")).toEqual([
        "file:///project/app/views/events/_card.turbo_stream.erb"
      ])
    })

    it("finds an html partial from a turbo_stream template", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = `<%= render partial: "card" %>`

      expect(uris(service, content, `"card"`, "file:///project/app/views/events/index.turbo_stream.erb")).toEqual([
        "file:///project/app/views/events/_card.html.erb"
      ])
    })

    it("finds a .herb partial", () => {
      const service = createService("/project/app/views/events/_card.html.herb")
      const content = `<%= render partial: "card" %>`

      expect(uris(service, content, `"card"`)).toHaveLength(1)
    })
  })

  describe("unresolvable references", () => {
    it("returns nothing for a partial that doesn't exist", () => {
      const service = createService()
      const content = `<%= render partial: "events/missing" %>`

      expect(definitions(service, content, "events/missing")).toEqual([])
    })

    it("returns nothing for a dynamic partial name", () => {
      const service = createService("/project/app/views/events/_some_variable.html.erb")
      const content = `<%= render partial: some_variable %>`

      expect(definitions(service, content, "some_variable")).toEqual([])
    })

    it("returns nothing for an interpolated partial name", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = "<%= render partial: \"events/#{kind}\" %>"

      expect(definitions(service, content, "events/")).toEqual([])
    })

    it("returns nothing when the position is not on the partial name", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home", locals: { event: event } %>`

      expect(definitions(service, content, "locals")).toEqual([])
    })

    it("returns nothing for markup outside a render call", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<div>text</div>\n<%= render partial: "events/featured_home" %>`

      expect(definitions(service, content, "<div>")).toEqual([])
    })

    it("returns nothing outside of app/views when the partial isn't next to the template", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = `<%= render partial: "card" %>`

      expect(definitions(service, content, `"card"`, "file:///project/lib/templates/mailer.html.erb")).toEqual([])
    })
  })
})
