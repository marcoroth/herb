import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { SlotFlash } from "../src/slots/flash"
import { HerbOverlay } from "../src/overlay/overlay"

const SLOT_EVENT = "herb:slot-update"

let flash: SlotFlash
let target: HTMLElement

function announce(operation = "value") {
  document.dispatchEvent(
    new CustomEvent(SLOT_EVENT, {
      detail: {
        file: "app/views/page/ask.html.erb",
        occurrence: 0,
        index: 0,
        operation,
        key: null,
        item: null,
        slot: { index: 0, attribute: null, anchor: { kind: "element", element: target } },
      },
    }),
  )
}

function drawn() {
  return [...document.querySelectorAll<HTMLElement>(".herb-slot-flash")]
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
})

describe("SlotFlash", () => {
  test("draws an overlay and a label for a slot that changed", () => {
    announce()

    expect(drawn()).toHaveLength(2)
  })

  test("the overlay it draws carries the styles that make it visible", () => {
    announce()

    const [overlay] = drawn()
    const styles = getComputedStyle(overlay)

    expect(overlay.style.length).toBeGreaterThan(0)
    expect(styles.position).toBe("absolute")
    expect(styles.backgroundColor).toBe("rgb(59, 130, 246)")
    expect(styles.pointerEvents).toBe("none")
    expect(parseFloat(styles.width)).toBeGreaterThan(0)
  })

  test("the label it draws carries its own styles and says what changed", () => {
    announce()

    const [, label] = drawn()
    const styles = getComputedStyle(label)

    expect(label.textContent).toBe("value ask.html.erb #0")
    expect(label.style.length).toBeGreaterThan(0)
    expect(styles.position).toBe("absolute")
    expect(styles.color).toBe("rgb(255, 255, 255)")
  })

  test("colours the overlay by the operation it reports", () => {
    announce("item-added")

    expect(getComputedStyle(drawn()[0]).backgroundColor).toBe("rgb(16, 185, 129)")
  })

  test("stops drawing and clears what it drew", () => {
    announce()
    flash.stop()

    expect(drawn()).toHaveLength(0)

    announce()

    expect(drawn()).toHaveLength(0)
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

  test("takes its flash with it, so a destroyed overlay draws nothing", () => {
    overlay().destroy()

    announce()

    expect(drawn()).toHaveLength(0)
  })

  test("leaves one overlay drawing once, however many came before it", () => {
    overlay().destroy()
    overlay().destroy()
    overlay()

    announce()

    expect(drawn()).toHaveLength(2)
  })
})
