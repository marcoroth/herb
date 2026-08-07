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

    return new DefinitionService(parserService, filePath => existing.has(filePath), () => "")
  }

  function createServiceWith(files: Record<string, string>) {
    return new DefinitionService(
      parserService,
      filePath => filePath in files,
      filePath => files[filePath] ?? null
    )
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

  describe("hover", () => {
    function hover(service: DefinitionService, content: string, target: string, uri = VIEW_URI) {
      const document = TextDocument.create(uri, "erb", 1, content)
      const position = document.positionAt(content.indexOf(target) + 1)
      const result = service.getHover(document, position)

      return result ? (result.contents as { value: string }).value : null
    }

    it("links the resolved partial", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<%= render partial: "events/featured_home" %>`

      expect(hover(service, content, "featured_home")).toBe(
        "[app/views/events/_featured_home.html.erb](file:///project/app/views/events/_featured_home.html.erb)"
      )
    })

    it("shows the strict locals of the resolved partial", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": `<%# locals: (event:, size: "sm") %>\n\n<div><%= event.name %></div>`
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain(`<%# locals: (event:, size: "sm") %>\n\n<div><%= event.name %></div>`)
      expect(message.match(/```erb/g)).toHaveLength(1)
    })

    it("shows a snippet when the partial has no strict locals", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": `<div class="card">\n  <h1><%= @event.name %></h1>\n</div>`
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).not.toContain("locals:")
      expect(message).toContain(`<div class="card">`)
      expect(message).toContain("<h1><%= @event.name %></h1>")
    })

    it("collapses the body of a long element", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": [
          `<div class="card">`,
          ...Array.from({ length: 12 }, (_, index) => `  <p>line ${index}</p>`),
          `</div>`
        ].join("\n")
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain(`<div class="card">`)
      expect(message).toContain("...")
      expect(message).toContain("</div>")
      expect(message).not.toContain("<p>line 5</p>")
    })

    it("collapses a long element into its outermost tags", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": [
          `<section`,
          `  class="a-very-long-set-of-utility-classes that-keeps-going and-going and-going"`,
          `  data-controller="card">`,
          ...Array.from({ length: 8 }, (_, index) => `  <p>line ${index}</p>`),
          `</section>`
        ].join("\n")
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("<section …>")
      expect(message).toContain("</section>")
      expect(message).not.toContain("data-controller")
    })

    it("collapses an ERB block into its opening and end tags", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": [
          `<% if event.published? %>`,
          ...Array.from({ length: 8 }, (_, index) => `  <p>line ${index}</p>`),
          `<% end %>`
        ].join("\n")
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("<% if event.published? %>")
      expect(message).toContain("<% end %>")
      expect(message).not.toContain("<p>line 5</p>")
    })

    it("links an empty partial without a preview", () => {
      const service = createServiceWith({ "/project/app/views/events/_card.html.erb": "\n  \n" })
      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("app/views/events/_card.html.erb")
      expect(message).not.toContain("```erb")
    })

    it("truncates content that has no opening and closing to collapse", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": Array.from({ length: 10 }, (_, index) => `line ${index}`).join("\n")
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("line 0")
      expect(message).toContain("...")
      expect(message).not.toContain("line 9")
    })

    it("previews an element that was never closed", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": [`<div class="card">`, ...Array.from({ length: 10 }, (_, index) => `  <p>line ${index}</p>`)].join("\n")
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain(`<div class="card">`)
      expect(message).toContain("...")
      expect(message).not.toContain("<p>line 9</p>")
    })

    it("signals that a partial has more than one top level node", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": `<h1>Title</h1>\n<p>Body</p>`
      })

      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("<h1>Title</h1>")
      expect(message).toContain("...")
      expect(message).not.toContain("<p>Body</p>")
    })

    it("previews the first match when several partials resolve", () => {
      const service = createServiceWith({
        "/project/app/views/events/_card.html.erb": `<div>next to the template</div>`,
        "/project/app/views/application/_card.html.erb": `<div>the fallback</div>`
      })

      const message = hover(service, `<%= render partial: "card" %>`, `"card"`)

      expect(message).toContain("app/views/events/_card.html.erb")
      expect(message).toContain("app/views/application/_card.html.erb")
      expect(message).toContain("<div>next to the template</div>")
      expect(message).not.toContain("<div>the fallback</div>")
    })

    it("still links a partial it can't read", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const message = hover(service, `<%= render partial: "events/card" %>`, "events/card")

      expect(message).toContain("app/views/events/_card.html.erb")
    })

    it("links the resolved layout", () => {
      const service = createService("/project/app/views/profiles/_tab_layout.html.erb")
      const content = `<%= render layout: "profiles/tab_layout" do %><% end %>`

      expect(hover(service, content, "tab_layout")).toContain("app/views/profiles/_tab_layout.html.erb")
    })

    it("shows a literal name example for a dynamic partial", () => {
      const service = createService()
      const message = hover(service, `<%= render partial: some_variable %>`, "some_variable")

      expect(message).toContain("Use a literal name and Herb can take you to it")
      expect(message).toContain(`<%= render partial: "events/card" %>`)
    })

    it("says a dynamic name can't be resolved", () => {
      const service = createService()
      const content = `<%= render partial: some_variable %>`
      const message = hover(service, content, "some_variable")

      expect(message).toContain("can't resolve this partial statically")
      expect(message).toContain("comes from a variable or method call")
    })

    it("says an interpolated name can't be resolved", () => {
      const service = createService()
      const content = "<%= render partial: \"events/#{kind}\" %>"
      const message = hover(service, content, "events/")

      expect(message).toContain("can't resolve this partial statically")
      expect(message).toContain("interpolated")
    })

    it("lists where it looked when nothing matches", () => {
      const service = createService()
      const content = `<%= render partial: "events/missing" %>`
      const message = hover(service, content, "events/missing")

      expect(message).toContain("No partial found for `events/missing`")
      expect(message).toContain("app/views/events/_missing.html.erb")
    })

    it("names the layout keyword when a layout is missing", () => {
      const service = createService()
      const content = `<%= render layout: "profiles/missing" do %><% end %>`

      expect(hover(service, content, "profiles/missing")).toContain("No layout found for `profiles/missing`")
    })

    it("returns nothing away from a render call", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<div>text</div>\n<%= render partial: "events/featured_home" %>`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)

      expect(service.getHover(document, document.positionAt(2))).toBeNull()
    })
  })

  describe("object and collection rendering", () => {
    function hoverText(service: DefinitionService, content: string, target: string) {
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const result = service.getHover(document, document.positionAt(content.indexOf(target) + 1))

      return result ? (result.contents as { value: string }).value : null
    }

    it("does not offer a definition for a bare object render", () => {
      const service = createService("/project/app/views/talks/_talk.html.erb")
      const content = `<%= render talks %>`

      expect(definitions(service, content, "talks")).toEqual([])
    })

    it("explains that the partial comes from to_partial_path", () => {
      const service = createService("/project/app/views/talks/_talk.html.erb")
      const message = hoverText(service, `<%= render talks %>`, "talks")

      expect(message).toContain("can't resolve this partial statically")
      expect(message).toContain("`to_partial_path` on `talks`")
    })

    it("covers the whole ERB tag when the partial can't be resolved", () => {
      const service = createService()
      const content = `<div>\n  <%= render talks %>\n</div>`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)

      for (const target of ["<%= render", "render talks", "talks %>"]) {
        const hover = service.getHover(document, document.positionAt(content.indexOf(target) + 1))

        expect(document.getText(hover!.range)).toBe("<%= render talks %>")
      }
    })

    it("keeps the hover on the name when the partial resolves", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = `<%= render partial: "events/card" %>`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const hover = service.getHover(document, document.positionAt(content.indexOf("events/card") + 1))

      expect(document.getText(hover!.range)).toBe("events/card")
    })

    it("shows how to name the partial for a collection render", () => {
      const service = createService("/project/app/views/talks/_talk.html.erb")
      const message = hoverText(service, `<%= render talks %>`, "talks")

      expect(message).toContain("Name the partial explicitly")
      expect(message).toContain("`object:` for a single record or `collection:` for many")
      expect(message).toContain(`<%= render partial: "path/to/partial", object: talks %>`)
    })

    it("explains an instance variable collection render", () => {
      const service = createService("/project/app/views/talks/_talk.html.erb")
      const message = hoverText(service, `<%= render @talks %>`, "@talks")

      expect(message).toContain("`to_partial_path` on `@talks`")
    })

    it("still resolves an explicit partial with a collection", () => {
      const service = createService("/project/app/views/talks/_talk.html.erb")
      const content = `<%= render partial: "talks/talk", collection: talks %>`

      expect(uris(service, content, "talks/talk")).toEqual([
        "file:///project/app/views/talks/_talk.html.erb"
      ])
    })
  })

  describe("interpolated partial names", () => {
    function hoverText(service: DefinitionService, content: string, target: string) {
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const result = service.getHover(document, document.positionAt(content.indexOf(target) + 1))

      return result ? (result.contents as { value: string }).value : null
    }

    it("does not offer a definition for a name that starts with interpolation", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = "<%= render partial: \"#{scope}/card\" %>"

      expect(definitions(service, content, "/card")).toEqual([])
    })

    it("explains that the name is interpolated", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = "<%= render partial: \"#{scope}/card\" %>"

      expect(hoverText(service, content, "/card")).toContain("interpolated")
    })

    it("treats an interpolated shorthand name as a partial, not an object", () => {
      const service = createService()
      const content = `<%= render "talks/#{scope}/card" %>`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const message = (service.getHover(document, document.positionAt(6))!.contents as { value: string }).value

      expect(message).toContain("The name is interpolated")
      expect(message).not.toContain("to_partial_path")
      expect(message).not.toContain("collection:")
    })

    it("explains an interpolated name given to the partial keyword", () => {
      const service = createService()
      const content = `<%= render partial: "talks/#{scope}/card" %>`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const message = (service.getHover(document, document.positionAt(6))!.contents as { value: string }).value

      expect(message).toContain("The name is interpolated")
      expect(message).not.toContain("to_partial_path")
    })

    it("does not offer a definition for a name that ends with interpolation", () => {
      const service = createService("/project/app/views/events/_card.html.erb")
      const content = "<%= render partial: \"events/#{kind}\" %>"

      expect(definitions(service, content, "events/")).toEqual([])
    })
  })

  describe("layout rendering", () => {
    it("resolves a layout partial", () => {
      const service = createService("/project/app/views/profiles/_tab_layout.html.erb")
      const content = `<%= render layout: "profiles/tab_layout", locals: { user: user } do %><% end %>`

      expect(uris(service, content, "profiles/tab_layout")).toEqual([
        "file:///project/app/views/profiles/_tab_layout.html.erb"
      ])
    })

    it("resolves from the layout keyword", () => {
      const service = createService("/project/app/views/profiles/_tab_layout.html.erb")
      const content = `<%= render layout: "profiles/tab_layout" do %><% end %>`

      expect(uris(service, content, "layout:")).toHaveLength(1)
    })

    it("resolves a render nested inside a layout block", () => {
      const service = createService("/project/app/views/profiles/_talks.html.erb")
      const content = [
        `<%= render layout: "profiles/tab_layout", locals: {`,
        `      user: @user`,
        `    } do %>`,
        `  <%= render partial: "profiles/talks", locals: { user: @user } %>`,
        `<% end %>`
      ].join("\n")

      expect(uris(service, content, "profiles/talks")).toEqual([
        "file:///project/app/views/profiles/_talks.html.erb"
      ])
    })
  })

  describe("documents with parse errors", () => {
    it("still resolves when the document has an unrelated error", () => {
      const service = createService("/project/app/views/events/_featured_home.html.erb")
      const content = `<div>\n  <%= render partial: "events/featured_home" %>\n`

      expect(uris(service, content, "events/featured_home")).toEqual([
        "file:///project/app/views/events/_featured_home.html.erb"
      ])
    })

    it("still explains a dynamic partial when the document has an error", () => {
      const service = createService()
      const content = `<div>\n  <%= render partial: some_variable %>\n`
      const document = TextDocument.create(VIEW_URI, "erb", 1, content)
      const hover = service.getHover(document, document.positionAt(content.indexOf("some_variable") + 1))

      expect((hover!.contents as { value: string }).value).toContain("can't resolve this partial statically")
    })
  })

  describe("unresolvable references", () => {
    it("returns nothing for a partial that doesn't exist", () => {
      const service = createService()
      const content = `<%= render partial: "events/missing" %>`

      expect(definitions(service, content, "events/missing")).toEqual([])
    })

    it("does not offer a definition for a dynamic partial name", () => {
      const service = createService("/project/app/views/events/_some_variable.html.erb")
      const content = `<%= render partial: some_variable %>`

      expect(definitions(service, content, "some_variable")).toEqual([])
    })

    it("does not offer a definition for an interpolated partial name", () => {
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
