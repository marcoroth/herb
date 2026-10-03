import { describe, test, expect, afterEach } from "vitest"
import { dom, element, resetDOM } from "./support/dom.js"

afterEach(resetDOM)

describe("the DOM helper", () => {
  test("keeps table markup that a div container would throw away", () => {
    const root = dom`<tr><td>x</td></tr>`

    expect(root.querySelectorAll("td").length).toBe(1)
    expect(root.innerHTML).toBe("<tr><td>x</td></tr>")
  })

  test("keeps the other elements that need a parent to be parsed", () => {
    expect(dom`<td>x</td>`.querySelectorAll("td").length).toBe(1)
    expect(dom`<tbody><tr><td>x</td></tr></tbody>`.querySelectorAll("tr").length).toBe(1)
    expect(dom`<option>x</option>`.querySelectorAll("option").length).toBe(1)
    expect(dom`<caption>x</caption>`.querySelectorAll("caption").length).toBe(1)
  })

  test("gives a style element a live sheet, because the document owns it", () => {
    const root = dom`<style scoped>.a { color: red }</style>`
    const style = root.querySelector("style") as HTMLStyleElement

    expect(style.sheet).not.toBeNull()
    expect(style.sheet!.cssRules.length).toBe(1)
  })

  test("still reads ordinary markup the way it is written", () => {
    expect(element`<div class="card"><p>hi</p></div>`.outerHTML).toBe(`<div class="card"><p>hi</p></div>`)
  })
})
