import { describe, test, expect, afterEach, vi } from "vitest"

import { HerbDevTools } from "../src/herb-dev-tools.js"

afterEach(() => {
  localStorage.clear()
  HerbDevTools.current?.stop()
  delete (window as any).HerbDevTools
  document.querySelector(".herb-floating-menu")?.remove()
  vi.restoreAllMocks()
})

const overlayOf = () => (HerbDevTools.current as any).overlay
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
