import dedent from "dedent"
import { describe, test, expect } from "vitest"

import { HerbHTMLNode } from "../src/herb-html-node.js"
import { setupHerb, createService, createDocument, getLanguageService, testDataProvider } from "./helpers.js"

describe("parseHTMLDocument", () => {
  setupHerb()

  test("parses a simple HTML element", () => {
    const service = createService()
    const document = createDocument(`<div class="foo"></div>`)
    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(1)

    const root = html.roots[0] as HerbHTMLNode
    expect(root.tag).toBe("div")
    expect(root.attributes).toEqual({ class: '"foo"' })
    expect(root.closed).toBe(true)
  })

  test("parses an ActionView tag helper as an HTML element", () => {
    const service = createService()
    const document = createDocument(`<%= tag.div class: "foo" %>`)
    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(1)

    const root = html.roots[0] as HerbHTMLNode
    expect(root.tag).toBe("div")
    expect(root.attributes).toEqual({ class: '"foo"' })
    expect(root.herbNode).toBeDefined()
    expect((root.herbNode as any).element_source).toBe("ActionView::Helpers::TagHelper#tag")
  })

  test("parses ActionView tag.img with content argument as void element", () => {
    const service = createService()
    const document = createDocument('<%= tag.img "/image.png" %>')
    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(1)

    const root = html.roots[0] as HerbHTMLNode
    expect(root.tag).toBe("img")
    expect(root.herbNode).toBeDefined()
    expect((root.herbNode as any).element_source).toBe("ActionView::Helpers::TagHelper#tag")
    expect((root.herbNode as any).is_void).toBe(true)
  })

  test("parses ActionView tag.img with content argument and data attributes", () => {
    const service = createService()
    const document = createDocument('<%= tag.img "/image.png", data: { controller: "image" } %>')
    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(1)

    const root = html.roots[0] as HerbHTMLNode
    expect(root.tag).toBe("img")
    expect(root.attributes?.["data-controller"]).toBe('"image"')
  })

  test("parses ActionView nested data hash into data-* attributes", () => {
    const service = createService()
    const document = createDocument(`<%= tag.div data: { controller: "scroll", action: "click->scroll#go" } %>`)
    const html = service.parseHTMLDocument(document)
    const root = html.roots[0]

    expect(root.tag).toBe("div")
    expect(root.attributes?.["data-controller"]).toBe('"scroll"')
    expect(root.attributes?.["data-action"]).toBe('"click->scroll#go"')
  })

  test("provides attributeSourceRanges for ActionView attributes", () => {
    const service = createService()
    const source = '<%= tag.div data: { controller: "scroll" } %>'
    const document = createDocument(source)

    const html = service.parseHTMLDocument(document)
    const root = html.roots[0] as HerbHTMLNode
    const range = root.attributeSourceRanges?.["data-controller"]

    expect(range).toBeDefined()
    expect(source.slice(range!.nameStart, range!.nameEnd)).toBe("controller")
    expect(source.slice(range!.valueStart, range!.valueEnd)).toBe('"scroll"')
  })

  test("provides attributeSourceRanges for regular HTML attributes", () => {
    const service = createService()
    const source = '<div data-controller="scroll"></div>'
    const document = createDocument(source)

    const html = service.parseHTMLDocument(document)
    const root = html.roots[0] as HerbHTMLNode
    const range = root.attributeSourceRanges?.["data-controller"]

    expect(range).toBeDefined()
    expect(source.slice(range!.nameStart, range!.nameEnd)).toBe("data-controller")
    expect(source.slice(range!.valueStart, range!.valueEnd)).toBe('"scroll"')
  })

  test("parses mixed HTML and ERB elements", () => {
    const service = createService()
    const document = createDocument(dedent`
      <%= tag.div data: { controller: "scroll" } %>
      <div data-controller="hello"></div>
    `)

    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(2)

    const first = html.roots[0]
    const second = html.roots[1]

    expect(first.tag).toBe("div")
    expect(second.tag).toBe("div")

    expect(first.attributes?.["data-controller"]).toBe('"scroll"')
    expect(second.attributes?.["data-controller"]).toBe('"hello"')
  })

  test("falls back to upstream parser when Herb is not loaded", () => {
    const service = getLanguageService({ customDataProviders: [testDataProvider] })
    const document = createDocument(`<div class="foo"></div>`)
    const html = service.parseHTMLDocument(document)

    expect(html.roots).toHaveLength(1)
  })

  describe("ERB control flow flattening", () => {
    test("flattens ERB if/else into HTML elements", () => {
      const service = createService()
      const document = createDocument(dedent`
        <% if condition %>
          <div></div>
        <% else %>
          <span></span>
        <% end %>
      `)
      const html = service.parseHTMLDocument(document)

      const tags = html.roots.map(node => node.tag)
      expect(tags).toContain("div")
      expect(tags).toContain("span")
    })

    test("flattens ERB each block", () => {
      const service = createService()
      const document = createDocument(dedent`
        <% @items.each do |item| %>
          <li><%= item.name %></li>
        <% end %>
      `)
      const html = service.parseHTMLDocument(document)

      const liNode = html.roots.find(node => node.tag === "li")
      expect(liNode).toBeDefined()
    })

    test("flattens nested ERB control flow", () => {
      const service = createService()
      const document = createDocument(dedent`
        <% if a %>
          <% if b %>
            <div></div>
          <% end %>
        <% end %>
      `)
      const html = service.parseHTMLDocument(document)

      const divNode = html.roots.find(node => node.tag === "div")
      expect(divNode).toBeDefined()
    })

    test("flattens ERB case/when", () => {
      const service = createService()
      const document = createDocument(dedent`
        <% case status %>
        <% when :active %>
          <span class="active"></span>
        <% when :inactive %>
          <span class="inactive"></span>
        <% end %>
      `)
      const html = service.parseHTMLDocument(document)

      const spans = html.roots.filter(node => node.tag === "span")
      expect(spans.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("findNodeAt / findNodeBefore", () => {
    test("findNodeAt returns the correct element", () => {
      const service = createService()
      const source = `<div data-controller="scroll"></div>`
      const document = createDocument(source)
      const html = service.parseHTMLDocument(document)

      const node = html.findNodeAt(15)
      expect(node.tag).toBe("div")
    })

    test("findNodeAt works for ERB tag helpers", () => {
      const service = createService()
      const source = `<%= tag.div data: { controller: "scroll" } %>`
      const document = createDocument(source)
      const html = service.parseHTMLDocument(document)

      const node = html.findNodeAt(20)
      expect(node.tag).toBe("div")
      expect(node.attributes?.["data-controller"]).toBe('"scroll"')
    })

    test("findNodeBefore returns the correct element", () => {
      const service = createService()
      const source = `<div></div><span></span>`
      const document = createDocument(source)
      const html = service.parseHTMLDocument(document)

      const node = html.findNodeBefore(15)
      expect(node.tag).toBe("span")
    })
  })
})
