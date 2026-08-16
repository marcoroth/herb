import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"
import type { Payload } from "../src/slot-index"

import fixture from "./fixtures/round-trip.json"

const values = fixture.values as Payload

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
    index.apply(values)

    expect(host.innerHTML).toBe(fixture.expected)
  })

  test("was not already that page, so the comparison means something", () => {
    expect(fixture.rendered).not.toBe(fixture.expected)
  })

  // Seven values arrive; two of them are the row ids, which are the same in both renderings, so
  // five is the count of what actually had to change.
  test("writes every value that differs and defers nothing", () => {
    const report = index.apply(values)

    expect(report.applied).toBe(5)
    expect(report.deferred).toEqual([])
  })

  test("applying the same values twice writes nothing the second time", () => {
    index.apply(values)

    expect(index.apply(values)).toEqual({ applied: 0, deferred: [] })
  })

  test("leaves every marker where it was, so the next update has the same page to work on", () => {
    index.apply(values)

    const reindexed = new SlotIndex()
    reindexed.scan(host)

    expect(reindexed.size).toBe(index.size)
  })

  test("refuses a payload compiled from a version the page does not carry", () => {
    const report = index.apply({ ...values, version: "deadbeef" })

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([
      { file: fixture.file, occurrence: 0, index: null, reason: "stale-version" },
    ])
    expect(host.innerHTML).toBe(fixture.rendered)
  })

  test("refuses a payload for a rendering that is not on the page", () => {
    const report = index.apply({ ...values, occurrence: 3 })

    expect(report.deferred[0].reason).toBe("no-region")
    expect(host.innerHTML).toBe(fixture.rendered)
  })
})
