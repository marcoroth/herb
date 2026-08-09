import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Range, CodeActionKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { ExtractCodeActionService, isExtractToPartialFailure } from "../src/extract_code_action_service"
import { ParserService } from "../src/parser_service"

import type { TextDocumentEdit, CreateFile } from "vscode-languageserver/node"
import type { ExtractToPartialSuccess } from "../src/extract_code_action_service"

const URI = "file:///project/app/views/users/show.html.erb"

describe("ExtractCodeActionService", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function createService(supportsPromptCommand = false) {
    return new ExtractCodeActionService(parserService, {
      supportsCreateFile: true,
      supportsPromptCommand
    })
  }

  function createDocument(content: string, uri = URI): TextDocument {
    return TextDocument.create(uri, "erb", 1, content)
  }

  function selectionOf(content: string, snippet: string): Range {
    const document = createDocument(content)
    const start = content.indexOf(snippet)

    return Range.create(document.positionAt(start), document.positionAt(start + snippet.length))
  }

  function extract(content: string, snippet: string, name: string, uri = URI) {
    const document = createDocument(content, uri)
    const result = createService().extractToPartial(document, selectionOf(content, snippet), name)

    if (isExtractToPartialFailure(result)) {
      throw new Error(result.error)
    }

    return result
  }

  function partialSource(result: ExtractToPartialSuccess): string {
    const documentChanges = result.edit.documentChanges as (CreateFile | TextDocumentEdit)[]
    const edit = documentChanges[1] as TextDocumentEdit

    return edit.edits[0].newText
  }

  function renderCall(result: ExtractToPartialSuccess): string {
    const documentChanges = result.edit.documentChanges as (CreateFile | TextDocumentEdit)[]
    const edit = documentChanges[2] as TextDocumentEdit

    return edit.edits[0].newText
  }

  describe("code actions", () => {
    it("offers an extract action for a selected element", () => {
      const content = dedent`
        <div class="user-card">
          <h1>Title</h1>
        </div>
      `

      const actions = createService().getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions).toHaveLength(1)
      expect(actions[0].kind).toBe(CodeActionKind.RefactorExtract)
      expect(actions[0].title).toBe("Herb: Extract to partial `users/user_card`")
      expect(actions[0].edit).toBeDefined()
    })

    it("offers a prompting action when the client supports the command", () => {
      const content = `<div id="banner">Hello</div>`

      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions).toHaveLength(1)
      expect(actions[0].title).toBe("Herb: Extract to partial…")
      expect(actions[0].edit).toBeUndefined()
      expect(actions[0].command?.command).toBe("herb.extractToPartial")
      expect(actions[0].command?.arguments?.[0]).toMatchObject({ uri: URI, suggestedName: "banner", locals: [] })
    })

    it("does not offer an action without a selection", () => {
      const content = `<div>Hello</div>`

      const actions = createService().getCodeActions(createDocument(content), Range.create(0, 3, 0, 3))

      expect(actions).toHaveLength(0)
    })

    it("does not offer an action for an incomplete selection", () => {
      const content = dedent`
        <div>
          <span>Hello</span>
        </div>
      `

      const actions = createService().getCodeActions(createDocument(content), selectionOf(content, "<div>\n  <span>Hello</span>"))

      expect(actions).toHaveLength(0)
    })

    it("does not offer an action when the client can't create files", () => {
      const content = `<div>Hello</div>`

      const service = new ExtractCodeActionService(parserService, { supportsCreateFile: false, supportsPromptCommand: false })

      expect(service.getCodeActions(createDocument(content), selectionOf(content, content))).toHaveLength(0)
    })
  })

  describe("partial file", () => {
    it("creates the partial next to the current template", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "greeting")

      expect(result.uri).toBe("file:///project/app/views/users/_greeting.html.erb")
      expect(result.renderKey).toBe("users/greeting")
    })

    it("places the partial relative to app/views when the name has a path", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "shared/greeting")

      expect(result.uri).toBe("file:///project/app/views/shared/_greeting.html.erb")
      expect(result.renderKey).toBe("shared/greeting")
    })

    it("keeps the template extension of the current document", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "greeting", "file:///project/app/views/users/show.turbo_stream.erb")

      expect(result.uri).toBe("file:///project/app/views/users/_greeting.turbo_stream.erb")
    })

    it("falls back to the document directory outside of app/views", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "greeting", "file:///project/templates/show.html.erb")

      expect(result.uri).toBe("file:///project/templates/_greeting.html.erb")
      expect(result.renderKey).toBe("greeting")
    })

    it("strips a leading underscore and the extension from the given name", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "_greeting.html.erb")

      expect(result.uri).toBe("file:///project/app/views/users/_greeting.html.erb")
    })

    it("tolerates surrounding slashes, dots and whitespace in the name", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "  ./shared//greeting/  ")

      expect(result.uri).toBe("file:///project/app/views/shared/_greeting.html.erb")
      expect(result.renderKey).toBe("shared/greeting")
    })

    it("rejects a name made only of separators", () => {
      const document = createDocument(`<div>Hello</div>`)
      const result = createService().extractToPartial(document, selectionOf(`<div>Hello</div>`, `<div>Hello</div>`), "/".repeat(50))

      expect(isExtractToPartialFailure(result)).toBe(true)
    })

    it("handles a long run of separators without backtracking", () => {
      const document = createDocument(`<div>Hello</div>`)
      const range = selectionOf(`<div>Hello</div>`, `<div>Hello</div>`)
      const name = `shared${"/".repeat(100_000)}greeting`
      const started = performance.now()

      const result = createService().extractToPartial(document, range, name)

      expect(performance.now() - started).toBeLessThan(500)
      expect(isExtractToPartialFailure(result)).toBe(false)
    })

    it("rejects an invalid name", () => {
      const document = createDocument(`<div>Hello</div>`)
      const result = createService().extractToPartial(document, selectionOf(`<div>Hello</div>`, `<div>Hello</div>`), "../etc/passwd")

      expect(isExtractToPartialFailure(result)).toBe(true)
    })

    it("dedents the extracted source", () => {
      const content = dedent`
        <section>
          <div>
            <span>Hello</span>
          </div>
        </section>
      `

      const snippet = dedent`
        <div>
            <span>Hello</span>
          </div>
      `

      const result = extract(content, snippet, "greeting")

      expect(partialSource(result)).toEqual(dedent`
        <div>
          <span>Hello</span>
        </div>
      ` + "\n")
    })
  })

  describe("locals", () => {
    it("turns instance variables into strict locals", () => {
      const content = `<div><%= @user.name %></div>`
      const result = extract(content, content, "user_card")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (user:) %>

        <div><%= user.name %></div>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/user_card", locals: { user: @user } %>`)
    })

    it("passes locals bound outside of the selection", () => {
      const content = dedent`
        <% users.each do |user| %>
          <div><%= user.name %></div>
        <% end %>
      `

      const result = extract(content, `<div><%= user.name %></div>`, "user_card")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (user:) %>

        <div><%= user.name %></div>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/user_card", locals: { user: user } %>`)
    })

    it("does not pass locals bound inside of the selection", () => {
      const content = dedent`
        <% total = items.sum(&:price) %>
        <div><%= total %></div>
      `

      const result = extract(content, content, "totals")

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/totals" %>`)
    })

    it("forwards the strict locals of the current partial", () => {
      const content = dedent`
        <%# locals: (user:, title:) %>

        <h1><%= title %></h1>
        <div><%= user.name %></div>
      `

      const result = extract(content, `<div><%= user.name %></div>`, "user_card")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (user:) %>

        <div><%= user.name %></div>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/user_card", locals: { user: user } %>`)
    })

    it("does not treat helper calls as locals", () => {
      const content = `<div><%= link_to "Home", root_path %></div>`
      const result = extract(content, content, "navigation")

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/navigation" %>`)
    })

    it("collects every local in order of appearance", () => {
      const content = `<div><%= @user.name %> <%= @account.title %></div>`
      const result = extract(content, content, "header")

      expect(partialSource(result)).toContain(`<%# locals: (user:, account:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/header", locals: { user: @user, account: @account } %>`)
    })

    it("keeps instance variables that are assigned inside of the selection", () => {
      const content = `<% @count = 1 %><div><%= @count %></div>`
      const result = extract(content, content, "counter")

      expect(partialSource(result)).toContain("@count")
      expect(partialSource(result)).not.toContain("locals:")
    })

    it("does not convert an instance variable that collides with a local", () => {
      const content = dedent`
        <% users.each do |user| %>
          <div><%= user.name %> <%= @user.id %></div>
        <% end %>
      `

      const result = extract(content, `<div><%= user.name %> <%= @user.id %></div>`, "user_card")

      expect(partialSource(result)).toContain("@user.id")
      expect(partialSource(result)).toContain(`<%# locals: (user:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/user_card", locals: { user: user } %>`)
    })
  })

  describe("partials without a strict locals declaration", () => {
    const PARTIAL_URI = "file:///project/app/views/users/_card.html.erb"

    it("infers locals from bare references", () => {
      const content = `<div><%= user.name %></div>`
      const result = extract(content, content, "user_name", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (user:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/user_name", locals: { user: user } %>`)
    })

    it("does not infer Action View helpers", () => {
      const content = `<div><%= link_to t(".home"), root_path %> <%= pluralize(2, "talk") %></div>`
      const result = extract(content, content, "navigation", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/navigation" %>`)
    })

    it("does not infer route helpers or predicates", () => {
      const content = `<div><%= current_page?(dashboard_path) ? "here" : "there" %></div>`
      const result = extract(content, content, "marker", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })

    it("does not infer locals in a regular template", () => {
      const content = `<div><%= user.name %></div>`
      const result = extract(content, content, "user_name")

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/user_name" %>`)
    })

    it("does not infer locals when the partial declares strict locals", () => {
      const content = dedent`
        <%# locals: (user:) %>

        <div><%= user.name %> <%= subtitle %></div>
      `

      const result = extract(content, `<div><%= user.name %> <%= subtitle %></div>`, "user_name", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (user:) %>`)
      expect(partialSource(result)).not.toContain("subtitle:")
    })
  })

  describe("locals assigned earlier in the same template", () => {
    it("passes a local assigned in an earlier ERB tag", () => {
      const content = dedent`
        <% featured = @event.talks.first %>

        <div><%= featured.title %></div>
      `

      const result = extract(content, `<div><%= featured.title %></div>`, "featured_talk")

      expect(partialSource(result)).toContain(`<%# locals: (featured:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/featured_talk", locals: { featured: featured } %>`)
    })

    it("passes locals from an earlier multiple assignment", () => {
      const content = dedent`
        <% first, second = @pair %>

        <div><%= first %><%= second %></div>
      `

      const result = extract(content, `<div><%= first %><%= second %></div>`, "pair")

      expect(partialSource(result)).toContain(`<%# locals: (first:, second:) %>`)
    })

    it("passes a local assigned inside an enclosing block", () => {
      const content = dedent`
        <% if @event %>
          <% featured = @event.talks.first %>
          <div><%= featured.title %></div>
        <% end %>
      `

      const result = extract(content, `<div><%= featured.title %></div>`, "featured_talk")

      expect(partialSource(result)).toContain(`<%# locals: (featured:) %>`)
    })

    it("does not pass a local that the selection reassigns", () => {
      const content = dedent`
        <% total = 0 %>

        <div><% total = 5 %><%= total %></div>
      `

      const result = extract(content, `<div><% total = 5 %><%= total %></div>`, "total")

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/total" %>`)
    })

    it("does not pass a name that is only assigned after the selection", () => {
      const content = dedent`
        <div><%= featured.title %></div>

        <% featured = @event.talks.first %>
      `

      const result = extract(content, `<div><%= featured.title %></div>`, "featured_talk")

      expect(partialSource(result)).not.toContain("locals:")
    })
  })

  describe("block iteration", () => {
    const CONTENT = dedent`
      <h1>
        <% @tags.each do |tag| %>
          <span><%= tag %></span>
        <% end %>
      </h1>
    `

    it("selecting the whole block passes the collection, not the block variable", () => {
      const snippet = dedent`
        <% @tags.each do |tag| %>
            <span><%= tag %></span>
          <% end %>
      `

      const result = extract(CONTENT, snippet, "tag_list")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (tags:) %>

        <% tags.each do |tag| %>
          <span><%= tag %></span>
        <% end %>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/tag_list", locals: { tags: @tags } %>`)
    })

    it("selecting only the block body passes the block variable", () => {
      const result = extract(CONTENT, `<span><%= tag %></span>`, "tag")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (tag:) %>

        <span><%= tag %></span>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/tag", locals: { tag: tag } %>`)
    })
  })

  describe("block iteration with a helper-named variable", () => {
    const PARTIAL_URI = "file:///project/app/views/users/_card.html.erb"

    const CONTENT = dedent`
      <h1>
        <% @tags.each do |tag| %>
          <span><%= tag.name %></span>
        <% end %>
      </h1>
    `

    it("selecting the whole block passes the collection, not the block variable", () => {
      const snippet = dedent`
        <% @tags.each do |tag| %>
            <span><%= tag.name %></span>
          <% end %>
      `

      const result = extract(CONTENT, snippet, "tag_list")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (tags:) %>

        <% tags.each do |tag| %>
          <span><%= tag.name %></span>
        <% end %>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/tag_list", locals: { tags: @tags } %>`)
    })

    it("selecting only the block body passes the block variable", () => {
      const result = extract(CONTENT, `<span><%= tag.name %></span>`, "tag")

      expect(partialSource(result)).toEqual(dedent`
        <%# locals: (tag:) %>

        <span><%= tag.name %></span>
      ` + "\n")

      expect(renderCall(result)).toBe(`<%= render partial: "users/tag", locals: { tag: tag } %>`)
    })

    it("prefers the Action View helper when nothing binds the name", () => {
      const content = `<span><%= tag.name %></span>`
      const result = extract(content, content, "tag", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/tag" %>`)
    })

    it("lets a declared strict local win over the helper name", () => {
      const content = dedent`
        <%# locals: (tag:) %>

        <span><%= tag.name %></span>
      `

      const result = extract(content, `<span><%= tag.name %></span>`, "tag", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (tag:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/tag", locals: { tag: tag } %>`)
    })
  })

  describe("unsafe local names", () => {
    it("does not turn an instance variable named after a Ruby keyword into a local", () => {
      const content = `<div class="<%= @class %>"><%= @end %></div>`
      const result = extract(content, content, "wrapper")

      expect(partialSource(result)).not.toContain("locals:")
      expect(partialSource(result)).toContain("@class")
      expect(partialSource(result)).toContain("@end")
      expect(renderCall(result)).toBe(`<%= render partial: "users/wrapper" %>`)
    })

    it("does not turn an instance variable named `local_assigns` into a local", () => {
      const content = `<div><%= @local_assigns %></div>`
      const result = extract(content, content, "debug")

      expect(partialSource(result)).not.toContain("locals:")
      expect(partialSource(result)).toContain("@local_assigns")
    })

    it("still converts instance variables that only shadow a helper", () => {
      const content = `<div><%= @title %> <%= @label %></div>`
      const result = extract(content, content, "heading")

      expect(partialSource(result)).toContain(`<%# locals: (title:, label:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/heading", locals: { title: @title, label: @label } %>`)
    })
  })

  describe("constants", () => {
    const PARTIAL_URI = "file:///project/app/views/users/_card.html.erb"

    it("does not turn a bare constant into a local", () => {
      const content = `<div><%= MAX_ITEMS %></div>`
      const result = extract(content, content, "limit", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
      expect(partialSource(result)).toContain("MAX_ITEMS")
    })

    it("does not turn constant paths into locals", () => {
      const content = `<div><%= User::ROLES.first %> <%= ::Account.count %> <%= Date.today %></div>`
      const result = extract(content, content, "meta", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })

    it("does not turn a constant passed to a helper into a local", () => {
      const content = `<div><%= truncate(talk.title, length: MAX_LENGTH) %></div>`
      const result = extract(content, content, "title", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (talk:) %>`)
      expect(partialSource(result)).toContain("MAX_LENGTH")
    })

    it("does not turn global or class variables into locals", () => {
      const content = `<div><%= $global %> <%= @@shared %></div>`
      const result = extract(content, content, "globals", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })
  })

  describe("extracting from a partial", () => {
    it("creates the new partial next to the source partial", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "avatar", "file:///project/app/views/users/_card.html.erb")

      expect(result.uri).toBe("file:///project/app/views/users/_avatar.html.erb")
      expect(result.renderKey).toBe("users/avatar")
    })

    it("keeps the full path for a partial nested below app/views", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "cell", "file:///project/app/views/admin/users/_row.html.erb")

      expect(result.uri).toBe("file:///project/app/views/admin/users/_cell.html.erb")
      expect(result.renderKey).toBe("admin/users/cell")
    })

    it("works for a partial in app/views/shared", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "notice", "file:///project/app/views/shared/_banner.html.erb")

      expect(result.uri).toBe("file:///project/app/views/shared/_notice.html.erb")
      expect(result.renderKey).toBe("shared/notice")
    })

    it("resolves a path name against app/views, not the source directory", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "shared/notice", "file:///project/app/views/admin/users/_row.html.erb")

      expect(result.uri).toBe("file:///project/app/views/shared/_notice.html.erb")
      expect(result.renderKey).toBe("shared/notice")
    })

    it("creates intermediate directories from a path name", () => {
      const result = extract(`<div>Hello</div>`, `<div>Hello</div>`, "admin/widgets/chart", "file:///project/app/views/shared/_banner.html.erb")

      expect(result.uri).toBe("file:///project/app/views/admin/widgets/_chart.html.erb")
      expect(result.renderKey).toBe("admin/widgets/chart")
    })
  })

  describe("partials with a strict locals declaration", () => {
    const PARTIAL_URI = "file:///project/app/views/users/_card.html.erb"

    it("forwards only the declared locals used in the selection", () => {
      const content = dedent`
        <%# locals: (user:, title:) %>

        <h1><%= title %></h1>
        <div><%= user.name %></div>
      `

      const result = extract(content, `<div><%= user.name %></div>`, "user_name", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (user:) %>`)
      expect(partialSource(result)).not.toContain("title:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/user_name", locals: { user: user } %>`)
    })

    it("forwards a local declared with a default value", () => {
      const content = dedent`
        <%# locals: (user:, size: "sm") %>

        <div class="<%= size %>"><%= user.name %></div>
      `

      const result = extract(content, `<div class="<%= size %>"><%= user.name %></div>`, "user_name", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (size:, user:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/user_name", locals: { size: size, user: user } %>`)
    })

    it("combines declared locals with instance variables", () => {
      const content = dedent`
        <%# locals: (user:) %>

        <div><%= user.name %> <%= @account.title %></div>
      `

      const result = extract(content, `<div><%= user.name %> <%= @account.title %></div>`, "header", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (user:, account:) %>`)
      expect(partialSource(result)).toContain(`<%= account.title %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/header", locals: { user: user, account: @account } %>`)
    })
  })

  describe("Action View helpers", () => {
    const PARTIAL_URI = "file:///project/app/views/users/_card.html.erb"

    it("does not infer helpers that take arguments", () => {
      const content = `<div><%= image_tag "logo.png" %> <%= number_to_currency(5) %> <%= t(".title") %></div>`
      const result = extract(content, content, "branding", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })

    it("does not infer helpers that take no arguments", () => {
      const content = `<head><%= csrf_meta_tags %><%= csp_meta_tag %></head>`
      const result = extract(content, content, "meta", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })

    it("does not infer a helper that takes a block", () => {
      const content = dedent`
        <%= form_with url: "/" do |form| %>
          <%= form.text_field :name %>
        <% end %>
      `

      const result = extract(content, content, "form", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
    })

    it("infers a local passed as a helper argument", () => {
      const content = `<div><%= pluralize(count, "talk") %> <%= link_to talk.title, talk_path(talk) %></div>`
      const result = extract(content, content, "summary", PARTIAL_URI)

      expect(partialSource(result)).toContain(`<%# locals: (count:, talk:) %>`)
      expect(renderCall(result)).toBe(`<%= render partial: "users/summary", locals: { count: count, talk: talk } %>`)
    })

    it("does not infer helpers in a regular template either", () => {
      const content = `<div><%= csrf_meta_tags %> <%= link_to "Home", root_path %></div>`
      const result = extract(content, content, "meta")

      expect(partialSource(result)).not.toContain("locals:")
    })

    it.fails("does not infer app-defined helpers from app/helpers", () => {
      const content = `<div><%= current_user.name %></div>`
      const result = extract(content, content, "greeting", PARTIAL_URI)

      expect(partialSource(result)).not.toContain("locals:")
      expect(renderCall(result)).toBe(`<%= render partial: "users/greeting" %>`)
    })
  })

  describe("suggested name", () => {
    it("uses the id attribute", () => {
      const content = `<div id="user-card">Hello</div>`
      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions[0].command?.arguments?.[0]).toMatchObject({ suggestedName: "user_card" })
    })

    it("falls back to the first class name", () => {
      const content = `<div class="user-card highlighted">Hello</div>`
      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions[0].command?.arguments?.[0]).toMatchObject({ suggestedName: "user_card" })
    })

    it("ignores utility class lists", () => {
      const content = `<section class="rounded-lg border bg-white p-6 shadow-sm">Hello</section>`
      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions[0].command?.arguments?.[0]).toMatchObject({ suggestedName: "section" })
    })

    it("falls back to the tag name", () => {
      const content = `<article>Hello</article>`
      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions[0].command?.arguments?.[0]).toMatchObject({ suggestedName: "article" })
    })

    it("falls back to a generic name", () => {
      const content = `<%= @user.name %>`
      const actions = createService(true).getCodeActions(createDocument(content), selectionOf(content, content))

      expect(actions[0].command?.arguments?.[0]).toMatchObject({ suggestedName: "partial" })
    })
  })
})
