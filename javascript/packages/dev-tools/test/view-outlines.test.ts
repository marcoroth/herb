import { describe, test, expect, afterEach } from "vitest"

import { HerbDevTools } from "../src/herb-dev-tools.js"

afterEach(() => {
  localStorage.clear()
  HerbDevTools.instance?.stop()
  delete (window as any).HerbDevTools
  document.querySelector(".herb-floating-menu")?.remove()
  document.querySelectorAll(".herb-overlay-label").forEach(label => label.remove())
  document.getElementById("root-without-height")?.remove()
  document.documentElement.removeAttribute("data-herb-debug-outline-type")
  document.documentElement.removeAttribute("data-herb-debug-file-name")
  document.documentElement.removeAttribute("style")
  document.body.innerHTML = ""
})

const overlayOf = () => (HerbDevTools.instance as any).overlay

const markAsView = (element: HTMLElement) => {
  element.setAttribute("data-herb-debug-outline-type", "view")
  element.setAttribute("data-herb-debug-file-name", "show.html.erb")
}

describe("view outlines", () => {
  // A layout whose root box is shorter than the viewport because everything in it is out of flow.
  test("keep a layout that positions against the initial containing block", () => {
    const style = document.createElement("style")

    style.id = "root-without-height"
    style.textContent = "html { height: 0 }"

    document.head.appendChild(style)
    document.body.innerHTML = `<div id="content" style="position: absolute; top: 40px; bottom: 20px; left: 0; right: 0"></div>`

    const content = document.getElementById("content") as HTMLElement

    markAsView(document.documentElement)

    HerbDevTools.start()
    overlayOf().toggleViewOutlines(true)

    expect(content.getBoundingClientRect().height).toBe(window.innerHeight - 60)
  })

  test("label the root element without positioning it", () => {
    markAsView(document.documentElement)

    HerbDevTools.start()
    overlayOf().toggleViewOutlines(true)

    expect(document.documentElement.querySelector(".herb-overlay-label")).not.toBeNull()
    expect(document.documentElement.style.position).toBe("")
  })

  test("still anchor a regular host", () => {
    document.body.innerHTML = `<div id="view"></div>`

    const view = document.getElementById("view") as HTMLElement

    markAsView(view)

    HerbDevTools.start()
    overlayOf().toggleViewOutlines(true)

    expect(view.style.position).toBe("relative")
  })
})
