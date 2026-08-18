import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"

import fixture from "./fixtures/round-trip.json"

type Values = { [index: string]: Value }
type Value = string | { branch?: number | null; slots?: Values; rows?: { [key: string]: Values } }

function applyValues(index: SlotIndex, file: string, values: Values, occurrence = 0): void {
  for (const [key, value] of Object.entries(values)) {
    const slotIndex = Number(key)

    if (typeof value === "string") {
      const slot = index.slot(file, slotIndex, occurrence)

      if (!slot) continue
      if (slot.attribute) index.setAttribute(slot, value)
      else index.update(slot, value)

      continue
    }

    if (value.rows) {
      for (const [rowKey, rowValues] of Object.entries(value.rows)) {
        for (const [innerKey, innerValue] of Object.entries(rowValues)) {
          const slot = index.slotInRow(file, slotIndex, rowKey, Number(innerKey), occurrence)

          if (!slot || typeof innerValue !== "string") continue
          if (slot.attribute) index.setAttribute(slot, innerValue)
          else index.update(slot, innerValue)
        }
      }

      continue
    }

    if (value.slots) applyValues(index, file, value.slots, occurrence)
  }
}

describe("a page given the values of a later render", () => {
  let host: HTMLElement
  let index: SlotIndex

  beforeEach(() => {
    document.body.innerHTML = ""

    host = document.createElement("div")
    host.innerHTML = fixture.rendered
    document.body.appendChild(host)

    index = new SlotIndex()
    index.scan(host)
  })

  test("becomes the page the server would have rendered from them", () => {
    applyValues(index, fixture.file, fixture.values.slots as Values)

    expect(host.innerHTML).toBe(fixture.expected)
  })

  test("was not already that page, so the comparison means something", () => {
    expect(fixture.rendered).not.toBe(fixture.expected)
  })

  test("names the version the markers on the page were compiled with", () => {
    expect(index.region(fixture.file)?.version).toBe(fixture.values.version)
  })

  test("leaves every marker where it was, so the next update has the same page to work on", () => {
    applyValues(index, fixture.file, fixture.values.slots as Values)

    const reindexed = new SlotIndex()
    reindexed.scan(host)

    expect(reindexed.size).toBe(index.size)
  })
})
