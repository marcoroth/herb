import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { report, clearOnNavigation, RUNTIME_ORIGIN } from "@herb-tools/client"

import { HerbDevTools } from "../src/index"

let devTools: HerbDevTools | null = null
let stopClearing: (() => void) | null = null

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ""
  document.head.innerHTML = `<meta name="herb-debug-mode" content="true">`
})

afterEach(() => {
  stopClearing?.()
  stopClearing = null
  devTools?.stop()
  devTools = null
  document.head.innerHTML = ""
})

describe("the client runtime reporting into the panel", () => {
  test("a diagnostic raised before start is delivered with the next one after it", () => {
    report({ template: "app/views/a.html.erb", message: "raised before the panel existed" })

    const instance = HerbDevTools.start({ devServer: false })!
    devTools = instance

    expect(instance.runtimePanel?.count).toBe(0)

    report({ template: "app/views/a.html.erb", message: "raised after", code: "herb-unknown-state" })

    expect(instance.runtimePanel?.count).toBe(2)
  })

  test("a navigation clears only the runtime's own findings", () => {
    const instance = HerbDevTools.start({ devServer: false })!
    devTools = instance
    stopClearing = clearOnNavigation()

    report({ template: "app/views/a.html.erb", message: "from the runtime" })
    instance.report({ template: "app/views/a.html.erb", message: "from the linter", origin: "Herb Linter" })

    expect(instance.runtimePanel?.count).toBe(2)

    document.dispatchEvent(new Event("turbo:load"))

    expect(instance.runtimePanel?.count).toBe(1)
  })

  test("entries carry the runtime origin the panel groups by", () => {
    const instance = HerbDevTools.start({ devServer: false })!
    devTools = instance

    const handle = instance.report({ template: "app/views/a.html.erb", message: "direct", origin: RUNTIME_ORIGIN })

    expect(instance.runtimePanel?.count).toBe(1)

    handle.dismiss()

    expect(instance.runtimePanel?.count).toBe(0)
  })
})
