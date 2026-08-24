import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex, SLOT_EVENT } from "../src/slot-index"
import type { Payload, SlotEventDetail } from "../src/types"

const FILE = "app/views/posts/index.html.erb"
const ITEMS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-item:0:a--><li data-herb-slot="1:child">one</li><!--/herb-item:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`
const CHILD = `<!--herb-region:${FILE}:aaaaaaaa:0--><p><!--herb-slot:0-->hi<!--/herb-slot:0--></p><!--/herb-region:${FILE}-->`

function watch(): SlotEventDetail[] {
  const seen: SlotEventDetail[] = []

  document.addEventListener(SLOT_EVENT, (event) => seen.push((event as CustomEvent<SlotEventDetail>).detail))

  return seen
}

describe("saying what changed", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("announces a value, naming the template it belongs to", () => {
    document.body.innerHTML = CHILD

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.update(index.slot(FILE, 0)!, "there")

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ file: FILE, occurrence: 0, index: 0, operation: "value" })
  })

  test("announces an item it built and an item it dropped, with the key", () => {
    document.body.innerHTML = ITEMS

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.apply({
      template: FILE,
      version: "bbbbbbbb",
      occurrence: 0,
      slots: { 0: { items: { b: { 1: "two" } } } },
    } as Payload)

    expect(seen.map((detail) => [detail.operation, detail.key])).toEqual([
      ["item-removed", "a"],
      ["item-added", "b"],
      ["value", null],
      ["built", null],
    ])
  })

  test("says what a payload built once the payload has landed", () => {
    document.body.innerHTML = ITEMS

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.apply({
      template: FILE,
      version: "bbbbbbbb",
      occurrence: 0,
      slots: { 0: { items: { b: { 1: "two" } } } },
    } as Payload)

    const last = seen[seen.length - 1]

    expect(last.operation).toBe("built")
    expect(last.cause).toBe("apply")
    expect(last.built?.items.map((entry) => entry.item.key)).toEqual(["b"])
    expect(last.built?.branches).toEqual([])
  })

  test("announces rewriting one item as an update, not as bare markup", () => {
    document.body.innerHTML = ITEMS

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.updateItem(index.slot(FILE, 0)!, "a", `<li data-herb-slot="1:child">ONE</li>`)

    expect(seen.map((detail) => [detail.operation, detail.key])).toEqual([["item-updated", "a"]])
  })

  test("says nothing when the value written is the value already there", () => {
    document.body.innerHTML = CHILD

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.update(index.slot(FILE, 0)!, "hi")

    expect(seen).toEqual([])
  })

  test("an item still exists when its removal is announced, so it can be pointed at", () => {
    document.body.innerHTML = ITEMS

    const index = new SlotIndex()
    index.scan(document.body)

    const seen: Array<{ key: string | null; connected: boolean }> = []

    document.addEventListener(SLOT_EVENT, (event) => {
      const detail = (event as CustomEvent<SlotEventDetail>).detail

      if (detail.operation === "item-removed") seen.push({ key: detail.key, connected: detail.item!.start.isConnected })
    })

    index.apply({
      template: FILE,
      version: "bbbbbbbb",
      occurrence: 0,
      slots: { 0: { items: {} } },
    } as Payload)

    expect(seen).toEqual([{ key: "a", connected: true }])
  })

  test("hands over the slot rather than measuring it, since measuring costs a layout", () => {
    document.body.innerHTML = CHILD

    const index = new SlotIndex()
    index.scan(document.body)

    const seen = watch()

    index.update(index.slot(FILE, 0)!, "there")

    expect(index.rangeOf(seen[0].slot!).toString()).toBe("there")
  })
})
