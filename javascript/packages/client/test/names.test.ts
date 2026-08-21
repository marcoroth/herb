import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"

const FILE = "app/views/posts/index.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul data-herb-name="0:messages"><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li id="a" data-herb-slot="1:attribute:id"><span data-herb-name="2:body" data-herb-slot="2:child">first</span></li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li id="b" data-herb-slot="1:attribute:id"><span data-herb-name="2:body" data-herb-slot="2:child">second</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<p data-herb-name="3:summary"><!--herb-slot:3-->two messages<!--/herb-slot:3--></p>` +
  `<!--/herb-region:${FILE}-->`

let index: SlotIndex

beforeEach(() => {
  document.body.innerHTML = PAGE

  index = new SlotIndex()
  index.scan(document.body)
})

describe("addressing a slot by name", () => {
  test("resolves a region-level name to its slot", () => {
    const slot = index.slot(FILE, "summary")

    expect(slot).not.toBeNull()
    expect(slot!.index).toBe(3)
  })

  test("resolves a named collection", () => {
    const slot = index.slot(FILE, "messages")

    expect(slot?.type).toBe("collection")
    expect(index.itemsFor(FILE, "messages").size).toBe(2)
  })

  test("resolves an item's slot per row through the item key", () => {
    const first = index.slotInItem(FILE, "messages", "a", "body")
    const second = index.slotInItem(FILE, "messages", "b", "body")

    expect(index.currentText(first!)).toBe("first")
    expect(index.currentText(second!)).toBe("second")
    expect(first).not.toBe(second)
  })

  test("resolves an attribute slot by its attribute name with nothing authored", () => {
    const slot = index.slotInItem(FILE, "messages", "a", "id")

    expect(slot?.attribute).toBe("id")
  })

  test("answers null for a name nothing declares", () => {
    expect(index.slot(FILE, "missing")).toBeNull()
    expect(index.slotInItem(FILE, "messages", "a", "missing")).toBeNull()
  })

  test("an index keeps working everywhere a name does", () => {
    expect(index.slot(FILE, "summary")).toBe(index.slot(FILE, 3))
    expect(index.slotInItem(FILE, 0, "a", 2)).toBe(index.slotInItem(FILE, "messages", "a", "body"))
  })
})
