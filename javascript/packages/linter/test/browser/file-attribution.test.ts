import { describe, test, expect } from "vitest"
import { dom } from "./support/dom.js"
import { createBrowserLinter } from "./support/browser-linter.js"

const lint = (markup: string) => {
  return createBrowserLinter({ only: ["html-img-require-alt"] }).lintElement(dom(markup) as any)
}

describe("the file an offense came from", () => {
  test("a stamped element names the file, line and column", () => {
    const { offenses } = lint(`<div data-herb-source="app/views/posts/_card.html.erb:8:3"><img src="/a.png"></div>`)

    expect(offenses).toHaveLength(1)
    expect(offenses[0].file?.toString()).toBe("app/views/posts/_card.html.erb:8:3")
  })

  test("an element inside a region marker names the file alone", () => {
    const { offenses } = lint(`<!--herb-region:app/views/posts/index.html.erb:c8082c87:0--><img src="/b.png"><!--/herb-region:app/views/posts/index.html.erb-->`)

    expect(offenses).toHaveLength(1)
    expect(offenses[0].file?.path).toBe("app/views/posts/index.html.erb")
    expect(offenses[0].file?.toString()).toBe("app/views/posts/index.html.erb:1:1")
  })

  test("an element with neither leaves the offense unattributed", () => {
    const { offenses } = lint(`<img src="/c.png">`)

    expect(offenses).toHaveLength(1)
    expect(offenses[0].file).toBeUndefined()
  })

  test("every rule that fires against a stamped tree gets one", () => {
    const markup = `<div data-herb-source="app/views/posts/_card.html.erb:8:3">
      <img src="/a.png">
      <iframe src="/x"></iframe>
      <a>no href</a>
      <h1></h1>
      <details><p>no summary</p></details>
      <input tabindex="5">
      <button aria-hidden="true">x</button>
      <p id="dup"></p><p id="dup"></p>
    </div>`

    const result = createBrowserLinter().lint(dom(markup) as any)

    const table = result.offenses.map((offense: any) => [offense.rule, offense.file ? "file" : "NO FILE"])

    expect(table.filter((row: any) => row[1] !== "file")).toEqual([])
    expect(table.length).toBe(8)
  })
})
