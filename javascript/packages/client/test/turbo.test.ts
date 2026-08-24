import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"

const FILE = "app/views/posts/index.html.erb"
const PARTIAL = "app/views/posts/_row.html.erb"

const region = (file: string, body: string, occurrence = 0) =>
  `<!--herb-region:${file}:aaaaaaaa:${occurrence}-->${body}<!--/herb-region:${file}-->`
const page = (name: string) => region(FILE, `<p><!--herb-slot:0-->${name}<!--/herb-slot:0--></p>`)
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("page navigation and Turbo", () => {
  let index: SlotIndex

  beforeEach(() => {
    document.body.innerHTML = ""
    index = new SlotIndex()
  })

  test("indexes the new page after the body is replaced", async () => {
    index.observe()

    document.body.innerHTML = page("before")
    await settle()
    expect(index.rangeOf(index.slot(FILE, 0)!).toString()).toBe("before")

    const next = document.createElement("body")
    next.innerHTML = page("after")
    document.body.replaceWith(next)
    await settle()

    expect(index.regionsFor(FILE)).toHaveLength(1)
    expect(index.rangeOf(index.slot(FILE, 0)!).toString()).toBe("after")

    index.disconnect()
  })

  test("drops the previous page rather than accumulating regions across visits", async () => {
    index.observe()

    for (const name of ["one", "two", "three"]) {
      const body = document.createElement("body")
      body.innerHTML = page(name)
      document.body.replaceWith(body)
      await settle()
    }

    expect(index.regionsFor(FILE)).toHaveLength(1)
    expect(index.rangeOf(index.slot(FILE, 0)!).toString()).toBe("three")

    index.disconnect()
  })

  test("indexes a partial that arrives inside a turbo-frame", async () => {
    document.body.innerHTML = `${page("page")}<turbo-frame id="rows"></turbo-frame>`
    index.observe()

    const frame = document.querySelector("#rows")!
    frame.innerHTML = region(PARTIAL, `<li><!--herb-slot:0-->row<!--/herb-slot:0--></li>`)
    await settle()

    expect(index.regionsFor(PARTIAL)).toHaveLength(1)
    expect(index.rangeOf(index.slot(PARTIAL, 0)!).toString()).toBe("row")

    index.disconnect()
  })

  test("follows a turbo-stream append and the removal that follows it", async () => {
    document.body.innerHTML = `<ul id="list"></ul>`
    index.observe()

    const list = document.querySelector("#list")!

    for (const [occurrence, name] of ["a", "b"].entries()) {
      const template = document.createElement("template")
      template.innerHTML = region(PARTIAL, `<li><!--herb-slot:0-->${name}<!--/herb-slot:0--></li>`, occurrence)
      list.append(template.content)
    }

    await settle()
    expect(index.regionsFor(PARTIAL)).toHaveLength(2)

    list.firstElementChild?.remove()
    list.childNodes[0]?.remove()
    await settle()

    expect(index.regionsFor(PARTIAL).length).toBeLessThan(2)

    index.disconnect()
  })

  test("re-indexes a restored cache snapshot rather than pointing at detached nodes", async () => {
    index.observe()

    document.body.innerHTML = page("live")
    await settle()

    const before = index.slot(FILE, 0)!

    const snapshot = document.body.innerHTML
    document.body.innerHTML = ""
    await settle()
    document.body.innerHTML = snapshot
    await settle()

    const after = index.slot(FILE, 0)!

    expect(index.regionsFor(FILE)).toHaveLength(1)
    expect(after).not.toBe(before)
    expect(index.rangeOf(after).toString()).toBe("live")

    index.disconnect()
  })
})
