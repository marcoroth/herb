import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import type { MockInstance } from "vitest"

import { HerbOverlay } from "../src/herb-overlay"
import { initHerbDevTools } from "../src/index"

const DOCUMENT_EVENTS = ["click", "turbo:load", "turbo:render", "turbo:visit"]

let addSpy: MockInstance
let removeSpy: MockInstance
let overlays: HerbOverlay[]

function callCountFor(spy: MockInstance, type: string) {
  return spy.mock.calls.filter(call => call[0] === type).length
}

function netDocumentListeners() {
  return Object.fromEntries(
    DOCUMENT_EVENTS.map(type => [type, callCountFor(addSpy, type) - callCountFor(removeSpy, type)])
  )
}

function createOverlay() {
  const overlay = new HerbOverlay()

  overlays.push(overlay)

  return overlay
}

function navigate() {
  document.querySelector(".herb-floating-menu")?.remove()
  document.dispatchEvent(new Event("turbo:load"))
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ""

  overlays = []
  addSpy = vi.spyOn(document, "addEventListener")
  removeSpy = vi.spyOn(document, "removeEventListener")
})

afterEach(() => {
  overlays.forEach(overlay => overlay.destroy())
  ;((window as any).HerbDevTools?._overlay as HerbOverlay | undefined)?.destroy()

  vi.restoreAllMocks()

  document.body.innerHTML = ""
  localStorage.clear()
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

describe("initHerbDevTools", () => {
  test("leaves exactly one live overlay when called repeatedly", () => {
    overlays.push(initHerbDevTools())

    const afterFirstInit = netDocumentListeners()

    for (let index = 0; index < 5; index++) {
      overlays.push(initHerbDevTools())
    }

    expect(netDocumentListeners()).toEqual(afterFirstInit)
    expect(document.querySelectorAll(".herb-floating-menu")).toHaveLength(1)
  })

  test("exposes the most recent overlay on the global", () => {
    initHerbDevTools()

    const overlay = initHerbDevTools()

    overlays.push(overlay)

    expect((window as any).HerbDevTools._overlay).toBe(overlay)
  })
})
