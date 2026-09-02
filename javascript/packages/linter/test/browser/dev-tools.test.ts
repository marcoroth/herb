import { describe, test, expect, afterEach } from "vitest"

import { reportToDevTools, toRuntimeDiagnostics, devToolsIn, LINTER_ORIGIN } from "../../src/browser/dev-tools.js"
import { dom, resetDOM } from "./support/dom.js"
import { createBrowserLinter } from "./support/browser-linter.js"

import type { DevToolsLike, RuntimeDiagnosticLike } from "../../src/browser/dev-tools.js"

afterEach(resetDOM)

function fakeDevTools() {
  const reported: RuntimeDiagnosticLike[][] = []
  const cleared: (string | undefined)[] = []
  let dismissed = 0

  const devTools: DevToolsLike = {
    report(input) {
      reported.push(Array.isArray(input) ? input : [input])

      return { dismiss: () => { dismissed += 1 } }
    },
    clear(origin) {
      cleared.push(origin)
    },
  }

  return { devTools, reported, cleared, dismissed: () => dismissed, scope: { HerbDevTools: devTools } }
}

const linter = () => createBrowserLinter({ only: ["html-img-require-alt"] })

describe("reporting to dev tools", () => {
  test("hands every offense over as a runtime diagnostic", () => {
    const { scope, reported } = fakeDevTools()
    const root = dom`<div data-herb-source="app/views/posts/_card.html.erb:8:3"><img src="/a.png"></div>`

    const { result, handle } = reportToDevTools(linter(), { root, scope })

    expect(result!.offenses).toHaveLength(1)
    expect(handle).not.toBeNull()
    expect(reported).toHaveLength(1)

    const [diagnostic] = reported[0]

    expect(diagnostic.template).toBe("app/views/posts/_card.html.erb")
    expect(diagnostic.code).toBe("html-img-require-alt")
    expect(diagnostic.severity).toBe("warning")
    expect(diagnostic.origin).toBe("Herb Linter (Rendered Page)")
    expect(diagnostic.phase).toBe("runtime")
    expect(diagnostic.overlay).toBe(false)
    expect(diagnostic.location?.start).toEqual({ line: 8, column: 2 })
    expect(diagnostic.docsUrl).toBe("https://herb-tools.dev/linter/rules/html-img-require-alt")
  })

  test("points the diagnostic at the element it is about", () => {
    const { scope, reported } = fakeDevTools()
    const root = dom`<div data-herb-source="a.html.erb:1:1"><img id="target" src="/a.png"></div>`

    reportToDevTools(linter(), { root, scope })

    expect(reported[0][0].element).toBe((root as any).querySelector("#target"))
  })

  test("names an unattributed offense rather than dropping it", () => {
    const { scope, reported } = fakeDevTools()

    reportToDevTools(linter(), { root: dom`<img src="/a.png">`, scope })

    expect(reported[0][0].template).toBe("(unknown template)")
    expect(reported[0][0].location).toBeUndefined()
  })

  test("clears its own findings first, so a second run replaces the first", () => {
    const { scope, cleared, reported } = fakeDevTools()
    const root = dom`<img src="/a.png">`

    reportToDevTools(linter(), { root, scope })
    reportToDevTools(linter(), { root, scope })

    expect(cleared).toEqual([LINTER_ORIGIN, LINTER_ORIGIN])
    expect(reported).toHaveLength(2)
  })

  test("does not lint at all when the toggle is off, and clears what it left", () => {
    const { scope, cleared, reported } = fakeDevTools()

    scope.HerbDevTools.lintingEnabled = false

    const { result, handle } = reportToDevTools(linter(), { root: dom`<img src="/a.png">`, scope })

    expect(result).toBeNull()
    expect(handle).toBeNull()
    expect(reported).toEqual([])
    expect(cleared).toEqual([LINTER_ORIGIN])
  })

  test("lints when the toggle is on", () => {
    const { scope, reported } = fakeDevTools()

    scope.HerbDevTools.lintingEnabled = true

    reportToDevTools(linter(), { root: dom`<img src="/a.png">`, scope })

    expect(reported[0]).toHaveLength(1)
  })

  test("lints when dev tools is too old to have a toggle", () => {
    const { scope, reported } = fakeDevTools()

    reportToDevTools(linter(), { root: dom`<img src="/a.png">`, scope })

    expect(reported[0]).toHaveLength(1)
  })

  test("still lints when the page has no dev tools on it", () => {
    const root = dom`<img src="/a.png">`

    const { result, handle } = reportToDevTools(linter(), { root, scope: {} })

    expect(result!.offenses).toHaveLength(1)
    expect(handle).toBeNull()
  })

  test("lints the body when no root is given", () => {
    const { scope, reported } = fakeDevTools()

    dom`<img src="/a.png">`
    reportToDevTools(linter(), { scope })

    expect(reported[0]).toHaveLength(1)
  })

  test("hands back a handle that dismisses what it reported", () => {
    const tools = fakeDevTools()
    const { handle } = reportToDevTools(linter(), { root: dom`<img src="/a.png">`, scope: tools.scope })

    handle!.dismiss()

    expect(tools.dismissed()).toBe(1)
  })
})

describe("finding dev tools", () => {
  test("answers with nothing when the page has none", () => {
    expect(devToolsIn({})).toBeNull()
  })

  test("answers with what the page has", () => {
    const { devTools, scope } = fakeDevTools()

    expect(devToolsIn(scope)).toBe(devTools)
  })
})

describe("converting a result", () => {
  test("turns every offense into a diagnostic", () => {
    const result = linter().lintElement(dom`<img src="/a.png"><img src="/b.png">`)

    expect(toRuntimeDiagnostics(result)).toHaveLength(2)
  })
})
