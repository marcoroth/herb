import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { SlotFlash } from "../src/slots/flash"
import { HerbOverlay } from "../src/overlay/overlay"

const SLOT_EVENT = "herb:slot-update"
const FILE = "app/views/page/ask.html.erb"

let flash: SlotFlash
let target: HTMLElement

function dispatch(detail: Record<string, unknown>) {
  document.dispatchEvent(new CustomEvent(SLOT_EVENT, { detail: { file: FILE, occurrence: 0, index: 0, key: null, item: null, ...detail } }))
}

function announce(operation = "value") {
  dispatch({ operation, slot: { index: 0, attribute: null, anchor: { kind: "element", element: target } } })
}

function drawn() {
  return [...document.querySelectorAll<HTMLElement>(".herb-slot-flash")]
}

function settle() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
  target = document.createElement("p")
  target.textContent = "hello"
  document.body.append(target)

  flash = new SlotFlash()
  flash.start()
})

afterEach(() => {
  flash.stop()
  target.remove()
  document.querySelectorAll(".herb-slot-flash").forEach(node => node.remove())
})

describe("SlotFlash", () => {
  test("draws an overlay and a label for a slot that changed", async () => {
    announce()
    await settle()

    expect(drawn()).toHaveLength(2)
  })

  test("the overlay it draws carries the styles that make it visible", async () => {
    announce()
    await settle()

    const [overlay] = drawn()
    const styles = getComputedStyle(overlay)

    expect(overlay.style.length).toBeGreaterThan(0)
    expect(styles.position).toBe("absolute")
    expect(styles.backgroundColor).toBe("rgb(59, 130, 246)")
    expect(styles.pointerEvents).toBe("none")
    expect(parseFloat(styles.width)).toBeGreaterThan(0)
  })

  test("the label it draws carries its own styles and says what changed", async () => {
    announce()
    await settle()

    const [, label] = drawn()
    const styles = getComputedStyle(label)

    expect(label.textContent).toBe("value ask.html.erb #0")
    expect(label.style.length).toBeGreaterThan(0)
    expect(styles.position).toBe("absolute")
    expect(styles.color).toBe("rgb(255, 255, 255)")
  })

  test("colours the overlay by the operation it reports", async () => {
    announce("item-added")
    await settle()

    expect(getComputedStyle(drawn()[0]).backgroundColor).toBe("rgb(16, 185, 129)")
  })

  test("stops drawing and clears what it drew", async () => {
    announce()
    await settle()
    flash.stop()

    expect(drawn()).toHaveLength(0)

    announce()
    await settle()

    expect(drawn()).toHaveLength(0)
  })
})

describe("an item the index moves after announcing it", () => {
  let list: HTMLElement

  function item(text: string) {
    const start = document.createComment(`herb-item:0:${text}`)
    const element = document.createElement("div")
    const end = document.createComment("/herb-item:0")

    element.textContent = text
    element.style.cssText = "height:40px"

    return { start, element, end, nodes: [start, element, end] }
  }

  beforeEach(() => {
    list = document.createElement("div")
    document.body.append(list)
  })

  afterEach(() => list.remove())

  test("draws where the item ended up, not where it was first inserted", async () => {
    const moved = item("moved")
    const settled = item("settled")

    list.append(...moved.nodes, ...settled.nodes)

    const inserted = moved.element.getBoundingClientRect().top

    dispatch({ operation: "item-added", key: "moved", item: moved, slot: { index: 0, attribute: null, anchor: { kind: "range", start: list.firstChild, end: list.lastChild } } })

    list.append(...moved.nodes)

    const final = moved.element.getBoundingClientRect().top

    expect(final, "the item has to actually move for this to prove anything").not.toBe(inserted)

    await settle()

    const [overlay] = drawn()

    expect(Math.round(parseFloat(overlay.style.top))).toBe(Math.round(final + scrollY))
  })

  test("outlines the collection it belongs to, without filling it", async () => {
    const one = item("one")
    const two = item("two")

    list.append(...one.nodes, ...two.nodes)

    dispatch({ operation: "item-added", key: "two", item: two, slot: { index: 0, attribute: null, anchor: { kind: "range", start: list.firstChild, end: list.lastChild } } })

    await settle()

    const box = document.querySelector<HTMLElement>(".herb-slot-flash-collection")!
    const styles = getComputedStyle(box)

    expect(box).not.toBeNull()
    expect(styles.outlineStyle).toBe("dashed")
    expect(styles.outlineColor).toBe("rgb(16, 185, 129)")
    expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(drawn()).toHaveLength(3)
  })

  test("outlines the collection in the colour of the operation, so a removal reads as one", async () => {
    const leaving = item("leaving")

    list.append(...leaving.nodes)

    dispatch({ operation: "item-removed", key: "leaving", item: leaving, slot: { index: 0, attribute: null, anchor: { kind: "range", start: list.firstChild, end: list.lastChild } } })

    const box = document.querySelector<HTMLElement>(".herb-slot-flash-collection")!

    expect(getComputedStyle(box).outlineColor).toBe("rgb(239, 68, 68)")
    expect(getComputedStyle(box).outlineStyle).toBe("dashed")
  })

  test("leaves a slot that is not part of a collection with no outline around it", async () => {
    announce()
    await settle()

    expect(document.querySelector(".herb-slot-flash-collection")).toBeNull()
    expect(drawn()).toHaveLength(2)
  })

  test("still draws an item that is on its way out, before it goes", async () => {
    const leaving = item("leaving")

    list.append(...leaving.nodes)

    const where = leaving.element.getBoundingClientRect().top

    dispatch({ operation: "item-removed", key: "leaving", item: leaving, slot: { index: 0, attribute: null, anchor: { kind: "range", start: list.firstChild, end: list.lastChild } } })

    leaving.nodes.forEach(node => node.remove())

    const overlay = drawn().find(node => !node.textContent && !node.classList.contains("herb-slot-flash-collection"))!

    expect(drawn()).toHaveLength(3)
    expect(Math.round(parseFloat(overlay.style.top))).toBe(Math.round(where + scrollY))
  })
})

describe("an overlay that goes away", () => {
  let overlays: HerbOverlay[]

  beforeEach(() => {
    flash.stop()

    overlays = []
    localStorage.setItem("herb-dev-tools-settings", JSON.stringify({ showingSlotUpdates: true }))
  })

  afterEach(() => {
    overlays.forEach(overlay => overlay.destroy())
    localStorage.clear()
    document.querySelectorAll(".herb-slot-flash").forEach(node => node.remove())
  })

  function overlay() {
    const created = new HerbOverlay()

    overlays.push(created)

    return created
  }

  test("takes its flash with it, so a destroyed overlay draws nothing", async () => {
    overlay().destroy()

    announce()
    await settle()

    expect(drawn()).toHaveLength(0)
  })

  test("leaves one overlay drawing once, however many came before it", async () => {
    overlay().destroy()
    overlay().destroy()
    overlay()

    announce()
    await settle()

    expect(drawn()).toHaveLength(2)
  })
})
