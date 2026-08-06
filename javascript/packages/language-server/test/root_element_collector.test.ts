import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Herb, getTagName } from "@herb-tools/node-wasm"

import { RootElementCollector } from "../src/root_element_collector"
import { ParserService } from "../src/parser_service"

describe("RootElementCollector", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function collect(source: string): RootElementCollector {
    const result = parserService.parseContent(source)
    const collector = new RootElementCollector()

    collector.visit(result.value)

    return collector
  }

  function tagName(source: string): string | null {
    return getTagName(collect(source).element)
  }

  it("collects the only element", () => {
    expect(tagName(`<article>Hello</article>`)).toBe("article")
  })

  it("keeps the first of several sibling elements", () => {
    expect(tagName(`<header>One</header><main>Two</main><footer>Three</footer>`)).toBe("header")
  })

  it("keeps the outermost element rather than a nested one", () => {
    const source = dedent`
      <section>
        <div>
          <span>Hello</span>
        </div>
      </section>
    `

    expect(tagName(source)).toBe("section")
  })

  it("skips leading text and ERB output", () => {
    expect(tagName(`Hello <%= @user.name %> <div>World</div>`)).toBe("div")
  })

  it("collects a void element", () => {
    expect(tagName(`<img src="a.png"> <div></div>`)).toBe("img")
  })

  it("is null without any element", () => {
    expect(collect(`<%= @user.name %>`).element).toBeNull()
  })

  it("is null for an empty document", () => {
    expect(collect(``).element).toBeNull()
  })
})
