import { describe, test, expect } from "vitest"
import { dom } from "./support/dom.js"
import { createBrowserLinter } from "./support/browser-linter.js"

const ruleNames = (result: any) => result.offenses.map((offense: any) => offense.rule).sort()

describe("linting what is on the page", () => {
  test("lint takes an element", () => {
    const root = dom(`<img src="/a.png">`)

    expect(ruleNames(createBrowserLinter().lint(root as any))).toEqual(["html-img-require-alt"])
  })

  test("lintElement takes the same element", () => {
    const root = dom(`<img src="/a.png">`)

    expect(ruleNames(createBrowserLinter().lintElement(root as any))).toEqual(["html-img-require-alt"])
  })

  test("lint still takes a string", () => {
    expect(ruleNames(createBrowserLinter().lint(`<img src="/a.png">`))).toEqual(["html-img-require-alt"])
  })

  test("lint on an element answers the way lintElement does", () => {
    const root = dom(`<p id="a"></p><p id="a"></p>`)

    expect(ruleNames(createBrowserLinter().lint(root as any))).toEqual(ruleNames(createBrowserLinter().lintElement(root as any)))
  })

  test("an element reaches the rules that need a live DOM", () => {
    const root = dom(`<style scoped>.used { color: red } .unused { color: blue }</style><p class="used"></p>`)

    expect(ruleNames(createBrowserLinter().lint(root as any))).toContain("browser-scoped-style-no-unused-selector")
  })

  test("a rule answered against the live DOM reports without a position", () => {
    const root = dom(`<style scoped>.gone { color: red }</style>`)

    const offense = createBrowserLinter().lint(root as any).offenses.find((one: any) => one.rule === "browser-scoped-style-no-unused-selector")

    expect(offense).toBeDefined()
    expect(offense!.location).toBeNull()
  })

  test("a string does not, because it has no stylesheets to ask about", () => {
    const result = createBrowserLinter().lint(`<style scoped>.unused { color: blue }</style>`)

    expect(ruleNames(result)).not.toContain("browser-scoped-style-no-unused-selector")
  })
})
