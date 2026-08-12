import { describe, test, expect } from "vitest"

import { Position } from "../src/index.js"
import { setupHerb, createService, createDocument } from "./helpers.js"

describe("doComplete", () => {
  setupHerb()

  describe("regular HTML", () => {
    test("provides attribute value completions", () => {
      const service = createService()
      const document = createDocument(`<div data-controller=""></div>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 22), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("hello")
      expect(labels).toContain("search")
    })

    test("provides attribute name completions", () => {
      const service = createService()
      const document = createDocument("<div ></div>")
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 5), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("data-controller")
      expect(labels).toContain("data-action")
    })
  })

  describe("ActionView tag helpers", () => {
    test("provides attribute value completions for data-controller", () => {
      const service = createService()
      const document = createDocument(`<%= tag.div data: { controller: "" } %>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 33), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("hello")
      expect(labels).toContain("search")
    })

    test("provides attribute value completions for data-action", () => {
      const service = createService()
      const document = createDocument(`<%= tag.div data: { action: "" } %>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 29), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("click->scroll#go")
    })

    test("provides completions for second value in multi-value attribute", () => {
      const service = createService()
      const source = '<%= tag.div data: { controller: "collapsible s" } %>'
      const document = createDocument(source)
      const html = service.parseHTMLDocument(document)
      const cursorOffset = source.indexOf("s\"") + 1

      const completions = service.doComplete(document, document.positionAt(cursorOffset), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("search")

      const firstItem = completions.items[0]

      if (firstItem.textEdit && "range" in firstItem.textEdit) {
        const editStart = document.offsetAt(firstItem.textEdit.range.start)
        const editEnd = document.offsetAt(firstItem.textEdit.range.end)
        expect(source.slice(editStart, editEnd)).toBe("s")
      }
    })

    test("provides underscored attribute names inside data: {} hash", () => {
      const service = createService()
      const source = '<%= tag.div(data: { controller: "dropdown",  }) %>'
      const document = createDocument(source)

      const html = service.parseHTMLDocument(document)
      const cursorOffset = source.indexOf(",  }") + 2
      const completions = service.doComplete(document, document.positionAt(cursorOffset), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)

      expect(labels).toContain("action")
      expect(labels).toContain("target")

      expect(labels).not.toContain("data-controller")
      expect(labels).not.toContain("data-action")
      expect(labels).not.toContain("controller")
    })

    test("returns empty completions for unknown attributes", () => {
      const service = createService()
      const document = createDocument('<%= tag.div data: { unknown: "" } %>')
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 30), html)

      expect(completions.items).toHaveLength(0)
    })
  })
})

describe("block argument completions", () => {
  setupHerb()

  const actionView = () => createService({ framework: "actionview" })

  test("completes the form builder a `form_with` yields", () => {
    const service = actionView()
    const document = createDocument(`<%= form_with model: @user do `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 30), html)

    expect(completions.items.map(item => item.label)).toEqual(["|form|"])
    expect(completions.items[0].detail).toBe("ActionView::Helpers::FormBuilder")
  })

  test("completes without the pipes when they are already typed", () => {
    const service = actionView()
    const document = createDocument(`<%= form_with model: @user do |`)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 31), html)

    expect(completions.items.map(item => item.label)).toEqual(["form"])
  })

  test("offers each arity a helper yields", () => {
    const service = actionView()
    const document = createDocument(`<%= link_to_if @ok, "Name", "/path" do `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 39), html)

    expect(completions.items.map(item => item.label)).toEqual([
      "|name|",
      "|name, options|",
      "|name, options, html_options|",
    ])
  })

  test("offers only the remaining arguments after a comma", () => {
    const service = actionView()
    const document = createDocument(`<%= link_to_if @ok, "Name", "/path" do |name, `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 46), html)

    expect(completions.items.map(item => item.label)).toEqual(["options", "options, html_options"])
  })

  test("completes the tag builder of a `turbo_frame_tag`", () => {
    const service = actionView()
    const document = createDocument(`<%= turbo_frame_tag "messages" do `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 34), html)

    expect(completions.items.map(item => item.label)).toEqual(["|tag|"])
  })

  test("does not complete a helper that yields nothing", () => {
    const service = actionView()
    const document = createDocument(`<% cache @post do `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 18), html)

    expect(completions.items.map(item => item.label)).not.toContain("|entry|")
  })

  test("does not complete a helper outside of an Action View project", () => {
    const service = createService()
    const document = createDocument(`<%= form_with model: @user do `)
    const html = service.parseHTMLDocument(document)
    const completions = service.doComplete(document, Position.create(0, 30), html)

    expect(completions.items.map(item => item.label)).not.toContain("|form|")
  })
})

describe("iteration block argument completions", () => {
  setupHerb()

  function labelsFor(source: string, options?: { framework?: string }) {
    const service = createService(options)
    const document = createDocument(source)

    return service.doComplete(document, Position.create(0, source.length), service.parseHTMLDocument(document)).items.map(item => item.label)
  }

  function insertTextFor(template: string) {
    const column = template.indexOf("CURSOR")
    const source = template.replace("CURSOR", "")
    const service = createService()
    const document = createDocument(source)

    return service.doComplete(document, Position.create(0, column), service.parseHTMLDocument(document)).items.map(item => item.insertText)
  }

  test("names the element after an instance variable", () => {
    expect(labelsFor("<% @speakers.each do ")).toEqual(["|speaker|"])
  })

  test("names the element after a local variable", () => {
    expect(labelsFor("<% speakers.each do ")).toEqual(["|speaker|"])
  })

  test("names the element after the last plural in the chain", () => {
    expect(labelsFor("<% @event.talks.where(status: \"confirmed\").each do ")).toEqual(["|talk|"])
  })

  test("names the element after the model when nothing in the chain is plural", () => {
    expect(labelsFor("<% BlogPost.published.each do ")).toEqual(["|blog_post|"])
  })

  test("handles plurals that are not just a trailing `s`", () => {
    expect(labelsFor("<% @categories.each do ")).toEqual(["|category|"])
    expect(labelsFor("<% @boxes.each do ")).toEqual(["|box|"])
    expect(labelsFor("<% @people.each do ")).toEqual(["|person|"])
  })

  test("offers the index for `each_with_index`", () => {
    expect(labelsFor("<% @speakers.each_with_index do ")).toEqual(["|speaker, index|", "|speaker|"])
  })

  test("suggests a counter for `times` and friends", () => {
    expect(labelsFor("<% 10.times do ")).toEqual(["|i|", "|index|"])
    expect(labelsFor("<% @speakers.count.times do ")).toEqual(["|i|", "|index|"])
    expect(labelsFor("<% 1.upto(5) do ")).toEqual(["|i|", "|index|"])
    expect(labelsFor("<% 10.downto(1) do ")).toEqual(["|i|", "|index|"])
  })

  test("says nothing for a receiver that only looks plural", () => {
    expect(labelsFor("<% @status.each do ")).toEqual([])
    expect(labelsFor("<% @news.each do ")).toEqual([])
  })

  test("says nothing for a singular receiver", () => {
    expect(labelsFor("<% @speaker.each do ")).toEqual([])
  })

  test("says nothing for a method that does not yield an element", () => {
    expect(labelsFor("<% @speakers.each_slice(2) do ")).toEqual([])
    expect(labelsFor("<% @speakers.each_cons(2) do ")).toEqual([])
  })

  test("does not need an Action View project", () => {
    expect(labelsFor("<% @speakers.each do ", { framework: "hanami" })).toEqual(["|speaker|"])
  })

  test("closes the pipe the completion is accepted into", () => {
    expect(insertTextFor("<% @speakers.each do |CURSOR %>")).toEqual(["speaker|"])
  })

  test("closes the pipe with the tag delimiter right behind the cursor", () => {
    expect(insertTextFor("<% @speakers.each do |CURSOR%>")).toEqual(["speaker|"])
  })

  test("leaves an already closed pipe alone", () => {
    expect(insertTextFor("<% @speakers.each do |CURSOR| %>")).toEqual(["speaker"])
  })

  test("inserts both pipes when neither is typed", () => {
    expect(insertTextFor("<% @speakers.each do CURSOR %>")).toEqual(["|speaker|"])
  })

  test("offers only what is left after a comma", () => {
    expect(insertTextFor("<% @events.each_with_index do |event, CURSOR %>")).toEqual(["index|"])
    expect(insertTextFor("<% @events.each_with_index do |event,CURSOR| %>")).toEqual(["index"])
  })

  test("says nothing once every argument is typed", () => {
    expect(insertTextFor("<% @events.each_with_index do |event, index, CURSOR %>")).toEqual([])
    expect(insertTextFor("<% @events.each do |event, CURSOR %>")).toEqual([])
    expect(insertTextFor("<% 10.times do |i, CURSOR %>")).toEqual([])
  })
})
