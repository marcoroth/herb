import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import type { MockInstance } from "vitest"

import { HerbOverlay } from "../src/overlay/overlay"
import { HerbDevTools } from "../src/index"

const DOCUMENT_EVENTS = ["click", "turbo:load", "turbo:render", "turbo:visit"]

let addSpy: MockInstance
let removeSpy: MockInstance
let overlays: HerbOverlay[]
let devTools: HerbDevTools[]

function callCountFor(spy: MockInstance, type: string) {
  return spy.mock.calls.filter(call => call[0] === type).length
}

function netDocumentListeners() {
  return Object.fromEntries(
    DOCUMENT_EVENTS.map(type => [type, callCountFor(addSpy, type) - callCountFor(removeSpy, type)])
  )
}

function injectedStyleNames() {
  return Array.from(document.querySelectorAll("style[data-herb-dev-tools]")).map(
    node => node.getAttribute("data-herb-dev-tools")
  )
}

function createOverlay() {
  const overlay = new HerbOverlay()

  overlays.push(overlay)

  return overlay
}

function startDevTools(options = {}) {
  const instance = HerbDevTools.start({ devServer: false, ...options })!

  devTools.push(instance)

  return instance
}

function navigate() {
  document.querySelector(".herb-floating-menu")?.remove()
  document.dispatchEvent(new Event("turbo:load"))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.body.innerHTML = ""

  overlays = []
  devTools = []
  addSpy = vi.spyOn(document, "addEventListener")
  removeSpy = vi.spyOn(document, "removeEventListener")
})

afterEach(() => {
  devTools.forEach(instance => instance.stop())
  overlays.forEach(overlay => overlay.destroy())

  vi.restoreAllMocks()

  document.body.innerHTML = ""
  localStorage.clear()
  sessionStorage.clear()
})

describe("HerbOverlay", () => {
  test("binds each document-level listener exactly once", () => {
    createOverlay()

    expect(netDocumentListeners()).toEqual({
      "click": 1,
      "turbo:load": 1,
      "turbo:render": 1,
      "turbo:visit": 1,
    })
  })

  test("does not accumulate document listeners across Turbo navigations", () => {
    createOverlay()

    const afterInit = netDocumentListeners()

    for (let index = 0; index < 20; index++) {
      navigate()

      expect(document.querySelectorAll(".herb-floating-menu")).toHaveLength(1)
    }

    expect(netDocumentListeners()).toEqual(afterInit)
  })

  test("closes the menu on an outside click after a navigation", () => {
    createOverlay()

    navigate()

    const trigger = document.getElementById("herbMenuTrigger") as HTMLElement
    const panel = document.getElementById("herbMenuPanel") as HTMLElement

    trigger.click()

    expect(trigger.classList.contains("active")).toBe(true)
    expect(panel.classList.contains("open")).toBe(true)

    document.body.click()

    expect(trigger.classList.contains("active")).toBe(false)
    expect(panel.classList.contains("open")).toBe(false)
  })

  test("keeps the menu open when clicking inside it after a navigation", () => {
    createOverlay()

    navigate()

    const trigger = document.getElementById("herbMenuTrigger") as HTMLElement
    const panel = document.getElementById("herbMenuPanel") as HTMLElement

    trigger.click()
    panel.click()

    expect(panel.classList.contains("open")).toBe(true)
  })

  test("destroy() unbinds every document listener and removes the menu", () => {
    const overlay = createOverlay()

    overlay.destroy()

    expect(netDocumentListeners()).toEqual({
      "click": 0,
      "turbo:load": 0,
      "turbo:render": 0,
      "turbo:visit": 0,
    })

    expect(document.querySelector(".herb-floating-menu")).toBeNull()
  })

  test("destroy() stops the overlay from reacting to Turbo navigations", () => {
    const overlay = createOverlay()

    overlay.destroy()

    document.dispatchEvent(new Event("turbo:load"))

    expect(document.querySelector(".herb-floating-menu")).toBeNull()
  })

  test("destroy() is safe to call more than once", () => {
    const overlay = createOverlay()

    overlay.destroy()

    const afterFirstDestroy = netDocumentListeners()

    overlay.destroy()
    overlay.destroy()

    expect(netDocumentListeners()).toEqual(afterFirstDestroy)
  })
})

describe("HerbDevTools", () => {
  test("does nothing until start() is called", () => {
    expect(HerbDevTools.instance).toBeNull()

    expect(netDocumentListeners()).toEqual({
      "click": 0,
      "turbo:load": 0,
      "turbo:render": 0,
      "turbo:visit": 0,
    })

    expect(document.querySelector(".herb-floating-menu")).toBeNull()
    expect(document.querySelector("style[data-herb-dev-tools]")).toBeNull()
    expect(window.HerbDevTools).toBeUndefined()
  })

  test("assigns the instance to the global on start()", () => {
    const instance = startDevTools()

    expect(window.HerbDevTools).toBe(instance)
  })

  test("injects one stylesheet per module on start() and removes them on stop()", () => {
    const instance = startDevTools()

    expect(injectedStyleNames()).toEqual(["base", "overlay", "runtime-panel"])

    instance.stop()

    expect(injectedStyleNames()).toEqual([])
  })

  test("leaves the runtime panel stylesheet out when the panel is off", () => {
    const instance = HerbDevTools.start({ devServer: false, runtimePanel: false })!

    expect(injectedStyleNames()).toEqual(["base", "overlay"])

    instance.stop()
  })

  test("ignores repeated start() calls", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const instance = startDevTools()

    const afterFirstStart = netDocumentListeners()

    for (let index = 0; index < 5; index++) {
      expect(HerbDevTools.start({ devServer: false })).toBeNull()
    }

    expect(HerbDevTools.instance).toBe(instance)
    expect(netDocumentListeners()).toEqual(afterFirstStart)
    expect(document.querySelectorAll(".herb-floating-menu")).toHaveLength(1)
    expect(injectedStyleNames()).toEqual(["base", "overlay", "runtime-panel"])
    expect(warn).toHaveBeenCalledTimes(5)
  })

  test("stop() tears down the overlay and releases the global", () => {
    const instance = startDevTools()

    instance.stop()

    expect(netDocumentListeners()).toEqual({
      "click": 0,
      "turbo:load": 0,
      "turbo:render": 0,
      "turbo:visit": 0,
    })

    expect(document.querySelector(".herb-floating-menu")).toBeNull()
    expect(window.HerbDevTools).toBeUndefined()
    expect(HerbDevTools.instance).toBeNull()
  })

  test("can be started again after stop()", () => {
    startDevTools().stop()

    const restarted = startDevTools()

    expect(HerbDevTools.instance).toBe(restarted)
    expect(document.querySelectorAll(".herb-floating-menu")).toHaveLength(1)
  })

  test("a stale instance cannot stop the running one", () => {
    const stale = startDevTools()

    stale.stop()

    const running = startDevTools()

    stale.stop()

    expect(HerbDevTools.instance).toBe(running)
    expect(document.querySelectorAll(".herb-floating-menu")).toHaveLength(1)
  })

  test("skips the overlay when it is disabled", () => {
    const instance = startDevTools({ overlay: false })

    expect(document.querySelector(".herb-floating-menu")).toBeNull()
    expect(instance.overlay).toBeNull()
    expect(window.HerbDevTools).toBe(instance)
  })

  test("exposes the overlay and the client on the global", () => {
    const instance = startDevTools()

    expect(window.HerbDevTools?.overlay).toBe(instance.overlay)
    expect(window.HerbDevTools?.overlay).toBeInstanceOf(HerbOverlay)
    expect(window.HerbDevTools?.client).toBeNull()
  })
})

describe("runtime diagnostics menu toggle", () => {
  function toggle() {
    return document.getElementById("herbToggleRuntimePanel") as HTMLInputElement | null
  }

  function openMenu() {
    ;(document.getElementById("herbMenuTrigger") as HTMLElement).click()
  }

  function badge() {
    return document.querySelector(".herb-dev-tools-badge")
  }

  function report(instance: HerbDevTools) {
    instance.report({ template: "app/views/posts/_post.html.erb", message: "Nested `<form>` elements are not allowed." })
  }

  test("rides along with the other menu toggles", () => {
    startDevTools()

    expect(toggle()).not.toBeNull()
    expect(toggle()!.closest(".herb-toggle-item")).not.toBeNull()
    expect(toggle()!.parentElement!.querySelector(".herb-toggle-text")!.textContent).toBe("Runtime Diagnostics")
    expect(toggle()!.checked).toBe(true)
  })

  test("stays out of the menu when the panel is switched off", () => {
    startDevTools({ runtimePanel: false })

    expect(toggle()).toBeNull()
  })

  test("reflects a dismissal made from the panel header", () => {
    const instance = startDevTools()

    report(instance)

    expect(badge()).not.toBeNull()

    instance.runtimePanel!.dismiss()

    expect(badge()).toBeNull()
    expect(toggle()!.checked).toBe(true)

    openMenu()

    expect(toggle()!.checked).toBe(false)
  })

  test("brings the badge back when switched on", () => {
    const instance = startDevTools()

    report(instance)
    instance.runtimePanel!.dismiss()
    openMenu()

    toggle()!.checked = true
    toggle()!.dispatchEvent(new Event("change"))

    expect(instance.runtimePanel!.dismissed).toBe(false)
    expect(badge()).not.toBeNull()
  })

  test("hides the badge when switched off", () => {
    const instance = startDevTools()

    report(instance)
    openMenu()

    toggle()!.checked = false
    toggle()!.dispatchEvent(new Event("change"))

    expect(instance.runtimePanel!.dismissed).toBe(true)
    expect(badge()).toBeNull()
  })

  test("carries the dismissal across a restart", () => {
    const first = startDevTools()

    report(first)
    openMenu()

    toggle()!.checked = false
    toggle()!.dispatchEvent(new Event("change"))

    first.stop()

    const second = startDevTools()

    report(second)

    expect(second.runtimePanel!.dismissed).toBe(true)
    expect(badge()).toBeNull()
    expect(toggle()!.checked).toBe(false)
  })

  test("never disagrees with the panel about the stored state", () => {
    const instance = startDevTools()
    const stored = () => JSON.parse(sessionStorage.getItem("herb-dev-tools-runtime-panel") ?? "{}").dismissed

    report(instance)
    openMenu()

    toggle()!.checked = false
    toggle()!.dispatchEvent(new Event("change"))

    expect(stored()).toBe(true)
    expect(instance.runtimePanel!.dismissed).toBe(true)

    instance.show()
    openMenu()
    openMenu()

    expect(stored()).toBe(false)
    expect(toggle()!.checked).toBe(true)
  })
})

describe("opening the runtime diagnostics", () => {
  function panel() {
    return document.querySelector(".herb-dev-tools-panel") as HTMLElement | null
  }

  function report(instance: HerbDevTools) {
    instance.report({
      template: "app/views/posts/_actions.html.erb",
      message: "Nested `<form>` elements are not allowed.",
    })
  }

  test("opens the panel and closes it again", () => {
    const instance = startDevTools()

    report(instance)

    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(false)

    instance.open()

    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)

    instance.close()

    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(false)
  })

  test("opens filling the window and back into the corner", () => {
    const instance = startDevTools()

    report(instance)

    instance.open({ expanded: true })

    expect(panel()!.classList.contains("herb-dev-tools-expanded")).toBe(true)

    instance.open({ expanded: false })

    expect(panel()!.classList.contains("herb-dev-tools-expanded")).toBe(false)
  })

  test("opens a panel that was hidden for the session", () => {
    const instance = startDevTools()

    report(instance)
    instance.runtimePanel!.dismiss()

    expect(panel()).toBeNull()

    instance.open()

    expect(instance.runtimePanel!.dismissed).toBe(false)
    expect(panel()!.classList.contains("herb-dev-tools-open")).toBe(true)
  })

  test("is a no-op when the panel is switched off", () => {
    const instance = startDevTools({ runtimePanel: false })

    expect(() => {
      instance.open()
      instance.open({ expanded: true })
      instance.close()
    }).not.toThrow()

    expect(panel()).toBeNull()
  })
})
