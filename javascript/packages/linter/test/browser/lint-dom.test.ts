import { describe, test, expect, afterEach } from "vitest"

import { sourcePathFor } from "../../src/browser/lint-dom.js"
import { domToAST } from "../../src/browser/dom-to-ast.js"
import { BrowserScopedStyleNoUnusedSelectorRule } from "../../src/browser/rules/browser-scoped-style-no-unused-selector.js"

import { dom, element, resetDOM } from "./support/dom.js"
import { createBrowserLinter, ruleFor } from "./support/browser-linter.js"

import type { HTMLElementNode } from "@herb-tools/core"

afterEach(resetDOM)

const linter = () => createBrowserLinter({ only: ["html-no-duplicate-ids", "a11y-nested-interactive-elements"] })

describe("linting a rendered page", () => {
  test("finds a duplicate id across two subtrees, which is what only a rendered page shows", () => {
    const tree = dom`
      <section><p id="note"></p></section>
      <aside><p id="note"></p></aside>
    `

    expect(linter().lintElement(tree).offenses.map((offense) => offense.message)).toEqual([
      "Duplicate ID `note` found. IDs must be unique within a document.",
    ])
  })

  test("says nothing when the ids are distinct" , () => {
    const tree = dom`
      <p id="one"></p>
      <p id="two"></p>
    `

    expect(linter().lintElement(tree).offenses).toEqual([])
  })

  test("cannot see a form nested in another form, because the browser deletes it on the way in", () => {
    const tree = element`<form><div><form></form></div></form>`
    const nested = createBrowserLinter({ only: ["html-no-nested-forms"] })

    expect(tree.querySelectorAll("form").length).toBe(0)
    expect(nested.lintElement(tree).offenses).toEqual([])
  })

  test("cannot see a link nested in another link, because the browser pulls them apart", () => {
    const tree = dom`<a href="/a"><span><a href="/b">x</a></span></a>`
    const nested = createBrowserLinter({ only: ["html-no-nested-links"] })

    expect(tree.querySelectorAll("a").length).toBe(2)
    expect(tree.querySelectorAll("a a").length).toBe(0)
    expect(nested.lintElement(tree).offenses).toEqual([])
  })

  test("reports without a position when nothing in the tree was stamped", () => {
    const tree = dom`
      <p id="note"></p>
      <p id="note"></p>
    `

    const [offense] = linter().lintElement(tree).offenses

    expect(offense).toBeDefined()
    expect(offense.location).toBeNull()
  })
})

describe("sourcePathFor", () => {
  test("reads the stamp off the element itself, back to what was written", () => {
    const source = element`<div data-herb-source="app/views/posts/_card.html.erb:8:3"></div>`
    const node = domToAST(source).children[0] as HTMLElementNode

    expect(sourcePathFor(node)!.toString()).toBe("app/views/posts/_card.html.erb:8:3")
  })

  test("walks up to the nearest stamped ancestor for markup that carries none", () => {
    const outer = element`<div data-herb-source="layout.html.erb:2:1"><span></span></div>`
    const node = domToAST(outer).children[0] as HTMLElementNode
    const span = node.body[0] as HTMLElementNode

    expect(sourcePathFor(span)!.toString()).toBe("layout.html.erb:2:1")
  })

  test("answers with nothing when nothing in the tree is stamped", () => {
    const node = domToAST(element`<div></div>`).children[0] as HTMLElementNode

    expect(sourcePathFor(node)).toBeNull()
  })

  test("reads the stamp against a project, so it can be written out in full", () => {
    const source = element`<div data-herb-source="app/views/x.html.erb:8:3"></div>`
    const node = domToAST(source).children[0] as HTMLElementNode

    expect(sourcePathFor(node, "/Users/marco/blog")!.absolute.toString()).toBe("/Users/marco/blog/app/views/x.html.erb:8:3")
  })

  test("answers with nothing for a node that came from no DOM element", () => {
    const node = domToAST(element`<div>hi</div>`).children[0] as HTMLElementNode

    expect(sourcePathFor(node.body[0])).toBeNull()
  })
})

describe("which rules run in the browser", () => {
  const tree = () => dom`
    <p id="note"></p>
    <p id="note"></p>
    <img>
  `

  const namesFor = (config?: any) => createBrowserLinter({ config }).lintElement(tree()).offenses.map((offense) => offense.rule)

  test("runs a rule that says it answers on a rendered page", () => {
    const names = namesFor()

    expect(names).toContain("html-no-duplicate-ids")
    expect(names).toContain("html-img-require-alt")
  })

  test("leaves out a rule that says nothing about where it runs", () => {
    const names = namesFor()

    expect(names).not.toContain("html-attribute-double-quotes")
    expect(names).not.toContain("erb-no-silent-statement")
  })

  test("lets config bring in a rule the rule itself leaves out", () => {
    const rule = ruleFor("html-no-self-closing")

    const withoutConfig = createBrowserLinter()
    const withConfig = createBrowserLinter({
      config: { linter: { rules: { "html-no-self-closing": { environments: ["cli", "browser"] } } } } as any
    })

    expect(withoutConfig.appliesTo(rule, "browser")).toBe(false)
    expect(withConfig.appliesTo(rule, "browser")).toBe(true)
  })

  test("lets config take out a rule the rule itself runs", () => {
    const config = { linter: { rules: { "html-no-duplicate-ids": { environments: ["cli"] } } } }

    expect(namesFor(config)).not.toContain("html-no-duplicate-ids")
  })

  test("takes a browser rule out when config narrows it to the command line", () => {
    const config = { linter: { rules: { "browser-scoped-style-no-unused-selector": { environments: ["cli"] } } } }
    const rule = new BrowserScopedStyleNoUnusedSelectorRule()

    expect(createBrowserLinter().appliesTo(rule, "browser")).toBe(true)
    expect(createBrowserLinter({ config: config as any }).appliesTo(rule, "browser")).toBe(false)
  })

  test("leaves the command line alone, where a rule saying nothing still runs", () => {
    const rule = ruleFor("html-attribute-double-quotes")

    expect(createBrowserLinter().appliesTo(rule, "cli")).toBe(true)
    expect(createBrowserLinter().appliesTo(rule, undefined)).toBe(true)
  })
})
