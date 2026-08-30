import { describe, test, expect } from "vitest"

import { BrowserScopedStyleNoUnusedSelectorRule } from "../../src/browser/rules/browser-scoped-style-no-unused-selector.js"
import { createBrowserRuleTest } from "./support/browser-rule-test.js"
import { dom } from "./support/dom.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createBrowserRuleTest(BrowserScopedStyleNoUnusedSelectorRule as any)

const unused = (selector: string) => `Selector \`${selector}\` matches nothing on the rendered page. Remove it, or check whether the markup it was written for still exists.`

describe("browser-scoped-style-no-unused-selector", () => {
  test("says nothing about a selector the page actually uses", () => {
    expectNoOffenses(`
      <style scoped>.card { color: red }</style>
      <div class="card">used</div>
    `)
  })

  test("reports a selector that matches nothing on the rendered page", () => {
    expectInfo(unused(".gone"))

    assertOffenses(`
      <style scoped>.gone { color: red }</style>
      <div class="card">used</div>
    `)
  })

  test("judges each selector on its own", () => {
    expectInfo(unused(".dead"))

    assertOffenses(`
      <style scoped>
        .used { color: red }
        .dead { color: red }
        .alive { color: red }
      </style>
      <div class="used"></div>
      <div class="alive"></div>
    `)
  })

  test("looks inside a media query", () => {
    expectInfo(unused(".nested-dead"))

    assertOffenses(`
      <style scoped>
        @media (min-width: 100px) {
          .nested-dead { color: red }
        }
      </style>
    `)
  })

  test("says nothing about a selector that matches the element it is scoped to", () => {
    expectNoOffenses(`
      <div class="card">
        <style scoped>.card { color: red }</style>
      </div>
    `)
  })

  test("never sees a selector the browser could not parse", () => {
    expectInfo(unused(".gone"))

    assertOffenses(`
      <style scoped>
        !!invalid { color: red }
        .gone { color: red }
      </style>
    `)
  })

  test("ignores a style element that is not scoped", () => {
    expectNoOffenses(`<style>.gone { color: red }</style>`)
  })

  test("finds a scoped block on a page the engine compiled, where `scoped` is already gone", () => {
    expectInfo(unused(".dead[data-herb-scope-2940ba8a]"))

    assertOffenses(`
      <style data-herb-style-scoped="data-herb-scope-2940ba8a">
        .used[data-herb-scope-2940ba8a] { color: red }
        .dead[data-herb-scope-2940ba8a] { color: red }
      </style>
      <div class="used" data-herb-scope-2940ba8a></div>
    `)
  })

  test("says nothing about a plain style element the engine never scoped", () => {
    expectNoOffenses(`
      <style>.gone { color: red }</style>
    `)
  })

  test("reads a selector the browser normalised, not the one that was written", () => {
    expectNoOffenses(`
      <style scoped>DIV.Card { color: red }</style>
      <div class="Card"></div>
    `)
  })
})

describe("where a browser rule's finding came from", () => {
  const check = (markup: string) => new BrowserScopedStyleNoUnusedSelectorRule().check(dom(markup) as any)

  test("names the file from the nearest stamp above the element", () => {
    const [offense] = check(`
      <div data-herb-source="app/views/posts/index.html.erb:3:1">
        <style data-herb-style-scoped="data-herb-scope-2940ba8a">.gone[data-herb-scope-2940ba8a] { color: red }</style>
      </div>
    `)

    expect(offense.file?.toString()).toBe("app/views/posts/index.html.erb:3:1")
  })

  test("reads a stamp on the style element itself", () => {
    const [offense] = check(`
      <style data-herb-style-scoped="data-herb-scope-2940ba8a" data-herb-source="app/views/posts/_card.html.erb:9:2">.gone[data-herb-scope-2940ba8a] { color: red }</style>
    `)

    expect(offense.file?.toString()).toBe("app/views/posts/_card.html.erb:9:2")
  })

  test("points at the style element it is about", () => {
    const root = dom`<style scoped id="sheet">.gone { color: red }</style>`
    const [offense] = new BrowserScopedStyleNoUnusedSelectorRule().check(root as any)

    expect(offense.element).toBe((root as any).querySelector("#sheet"))
  })

  test("leaves the file out when nothing above it was stamped", () => {
    const [offense] = check(`<style scoped>.gone { color: red }</style>`)

    expect(offense.file).toBeUndefined()
  })
})
