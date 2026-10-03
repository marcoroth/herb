import { describe, test, expect, afterEach, beforeEach, vi } from "vitest"

import { HerbDevTools } from "../src/herb-dev-tools.js"

afterEach(() => {
  localStorage.clear()
  HerbDevTools.instance?.stop()
  delete (window as any).HerbDevTools
  document.querySelector(".herb-floating-menu")?.remove()
  vi.restoreAllMocks()
})

const overlayOf = () => (HerbDevTools.instance as any).overlay
const trigger = () => document.getElementById("herbMenuTrigger") as HTMLElement
const isOpen = () => document.getElementById("herbMenuPanel")!.classList.contains("open")

describe("the dev tools menu", () => {
  test("opens on a click", () => {
    localStorage.clear()

    HerbDevTools.start()

    trigger().click()

    expect(isOpen()).toBe(true)
  })

  test("keeps toggling once per click after a second setup pass, which a double init causes", () => {
    HerbDevTools.start()

    const states: boolean[] = []

    overlayOf().setupMenuToggle()

    trigger().click()
    states.push(isOpen())

    trigger().click()
    states.push(isOpen())

    trigger().click()
    states.push(isOpen())

    expect(states).toEqual([true, false, true])
  })

  test("closes again on the next click", () => {
    HerbDevTools.start()

    overlayOf().setupMenuToggle()

    trigger().click()
    trigger().click()

    expect(isOpen()).toBe(false)
  })
})

describe("measurements on outlines", () => {
  const PAYLOAD = {
    version: 1,
    diagnostics: [
      {
        template: "app/views/posts/_post.html.erb",
        message: "This ERB tag ran 5 SQL queries while the page rendered.",
        code: "sql-queries",
        kind: "metric",
        origin: "Herb Engine",
        value: "5 SQL queries",
        location: { start: { line: 2, column: 1 } },
      },
      {
        template: "app/views/posts/_post.html.erb",
        message: "This tag rendered once, taking 1.4 ms.",
        code: "render-time",
        kind: "metric",
        origin: "Herb Engine",
        value: "1.4 ms",
        location: { start: { line: 6, column: 1 } },
      },
      {
        template: "app/views/posts/index.html.erb",
        message: "Image is missing an alt attribute.",
        code: "html-img-require-alt",
        severity: "warning",
        origin: "Herb Linter",
        location: { start: { line: 3, column: 3 } },
      },
    ],
  }

  function embedReport() {
    const script = document.createElement("script")

    script.type = "application/json"
    script.setAttribute("data-herb-diagnostics", "")
    script.textContent = JSON.stringify(PAYLOAD)

    document.body.appendChild(script)
  }

  function outlined(template: string) {
    const element = document.createElement("section")

    element.setAttribute("data-herb-debug-outline-type", "partial")
    element.setAttribute("data-herb-debug-file-name", template.split("/").pop()!)
    element.setAttribute("data-herb-debug-file-relative-path", template)

    document.body.appendChild(element)

    return element
  }

  function measured(element: HTMLElement) {
    return element.querySelector(".herb-overlay-label-measured") as HTMLElement | null
  }

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("says nothing until the toggle is on", () => {
    embedReport()

    const element = outlined("app/views/posts/_post.html.erb")

    HerbDevTools.start()
    overlayOf().togglePartialOutlines(true)

    expect(element.querySelector(".herb-overlay-label")).not.toBeNull()
    expect(measured(element)).toBeNull()

    overlayOf().toggleOutlineMetrics(true)

    expect(measured(element)!.textContent).toBe("5 SQL queries · 1.4 ms")
  })

  test("takes it away again, and remembers either way", () => {
    embedReport()

    const element = outlined("app/views/posts/_post.html.erb")

    HerbDevTools.start()
    overlayOf().togglePartialOutlines(true)
    overlayOf().toggleOutlineMetrics(true)

    expect(JSON.parse(localStorage.getItem("herb-dev-tools-settings")!).showingOutlineMetrics).toBe(true)

    overlayOf().toggleOutlineMetrics(false)

    expect(measured(element)).toBeNull()
    expect(JSON.parse(localStorage.getItem("herb-dev-tools-settings")!).showingOutlineMetrics).toBe(false)
  })

  test("says nothing for a file that measured nothing", () => {
    embedReport()

    const element = outlined("app/views/posts/index.html.erb")

    HerbDevTools.start()
    overlayOf().togglePartialOutlines(true)
    overlayOf().toggleOutlineMetrics(true)

    expect(element.querySelector(".herb-overlay-label")).not.toBeNull()
    expect(measured(element)).toBeNull()
  })
})
