import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"
import type { DependencyMap } from "../src/state"
import type { Item, Payload, Slot, SlotType } from "../src/types"

import aBlockAndWhatFollowsIt from "./fixtures/contract/a-block-and-what-follows-it.json"
import aBooleanAttributeDrivenByAValue from "./fixtures/contract/a-boolean-attribute-driven-by-a-value.json"
import aBooleanAttributeInsideABlock from "./fixtures/contract/a-boolean-attribute-inside-a-block.json"
import aCollectionInsideABranch from "./fixtures/contract/a-collection-inside-a-branch.json"
import aConditionalInsideABlock from "./fixtures/contract/a-conditional-inside-a-block.json"
import aConditionalMatchingNothing from "./fixtures/contract/a-conditional-matching-nothing.json"
import aConditionalThatBranches from "./fixtures/contract/a-conditional-that-branches.json"
import aConditionalThatCollapses from "./fixtures/contract/a-conditional-that-collapses.json"
import aHelperBlockBuildingAnElement from "./fixtures/contract/a-helper-block-building-an-element.json"
import aKeyedCollection from "./fixtures/contract/a-keyed-collection.json"
import aKeyedCollectionWithDeclaredItemState from "./fixtures/contract/a-keyed-collection-with-declared-item-state.json"
import aKeyedCollectionWhoseKeysCarryMarkup from "./fixtures/contract/a-keyed-collection-whose-keys-carry-markup.json"
import aValueCarryingMarkupAndQuotes from "./fixtures/contract/a-value-carrying-markup-and-quotes.json"
import anAttributeAndAChild from "./fixtures/contract/an-attribute-and-a-child.json"
import anEmptyCollection from "./fixtures/contract/an-empty-collection.json"
import anInterpolatedAttributeInsideABlock from "./fixtures/contract/an-interpolated-attribute-inside-a-block.json"
import expressionsInOrder from "./fixtures/contract/expressions-in-order.json"
import nothingDynamicAtAll from "./fixtures/contract/nothing-dynamic-at-all.json"
import twoAttributesOnOneElement from "./fixtures/contract/two-attributes-on-one-element.json"

interface SchemaSlot {
  index: number
  type: string
  attribute?: string
  name?: string
}

interface Fixture {
  file: string
  template: string
  rendered: string
  client: string
  values: Payload
  expected: string
  schema: { file: string; identifier: string; version: string; slots: SchemaSlot[] }
  manifest: { file: string; identifier: string; version: string; names: Record<string, number>; parts: Record<string, string[]>; states: unknown }
  dependencies: DependencyMap
}

const FIXTURES: Record<string, Fixture> = {
  "a block and what follows it": aBlockAndWhatFollowsIt as Fixture,
  "a boolean attribute driven by a value": aBooleanAttributeDrivenByAValue as Fixture,
  "a boolean attribute inside a block": aBooleanAttributeInsideABlock as Fixture,
  "a collection inside a branch": aCollectionInsideABranch as Fixture,
  "a conditional inside a block": aConditionalInsideABlock as Fixture,
  "a conditional matching nothing": aConditionalMatchingNothing as Fixture,
  "a conditional that branches": aConditionalThatBranches as Fixture,
  "a conditional that collapses": aConditionalThatCollapses as Fixture,
  "a helper block building an element": aHelperBlockBuildingAnElement as Fixture,
  "a keyed collection": aKeyedCollection as Fixture,
  "a keyed collection with declared item state": aKeyedCollectionWithDeclaredItemState as Fixture,
  "a keyed collection whose keys carry markup": aKeyedCollectionWhoseKeysCarryMarkup as Fixture,
  "an attribute and a child": anAttributeAndAChild as Fixture,
  "an empty collection": anEmptyCollection as Fixture,
  "an interpolated attribute inside a block": anInterpolatedAttributeInsideABlock as Fixture,
  "expressions in order": expressionsInOrder as Fixture,
  "nothing dynamic at all": nothingDynamicAtAll as Fixture,
  "a value carrying markup and quotes": aValueCarryingMarkupAndQuotes as Fixture,
  "two attributes on one element": twoAttributesOnOneElement as Fixture,
}

const PARKED_REASONS = ["branch", "block", "items", "partial-attribute"]

const UNCHANGED = ["nothing dynamic at all", "a boolean attribute inside a block"]

function mount(markup: string, fixture?: Fixture): HTMLElement {
  document.body.innerHTML = ""

  const host = document.createElement("div")
  const manifest = fixture ? container(fixture) : ""

  host.innerHTML = markup + manifest
  document.body.appendChild(host)

  return host
}

function container(fixture: Fixture): string {
  const manifest = fixture.manifest

  return `<template data-herb-manifests>${JSON.stringify({ [`${manifest.identifier}:${manifest.version}`]: manifest })}</template>`
}

function serialized(markup: string): string {
  const holder = document.createElement("div")

  holder.innerHTML = markup

  return holder.innerHTML
}

function found(index: SlotIndex, file: string): Map<number, Slot> {
  const slots = new Map<number, Slot>()

  const visit = (slot: Slot): void => {
    slots.set(slot.index, slot)

    for (const item of slot.items.values()) {
      visitItem(item)
    }
  }

  const visitItem = (item: Item): void => {
    for (const slot of item.slots.values()) {
      visit(slot)
    }
  }

  for (const region of index.regionsFor(file)) {
    for (const slot of region.slots.values()) {
      visit(slot)
    }
  }

  return slots
}

describe("the contract table", () => {
  test("renders every fixture but the static ones differently before and after", () => {
    const same = Object.entries(FIXTURES).filter(([, fixture]) => fixture.rendered === fixture.expected)

    expect(same.map(([label]) => label).sort()).toEqual([...UNCHANGED].sort())
  })
})

describe.each(Object.entries(FIXTURES))("the contract for %s", (_label, fixture) => {
  const schema = new Map(fixture.schema.slots.map((slot) => [slot.index, slot]))

  let index: SlotIndex

  beforeEach(() => {
    index = new SlotIndex()
  })

  test("indexes only slots the compiler recorded, as the type and attribute it recorded", () => {
    index.scan(mount(fixture.rendered, fixture))

    for (const [number, slot] of found(index, fixture.file)) {
      const recorded = schema.get(number)

      expect(recorded, `slot ${number} is on the page but not in the schema`).toBeDefined()
      expect(slot.type).toBe(recorded!.type as SlotType)
      expect(slot.attribute).toBe(recorded!.attribute ?? null)
    }
  })

  test("indexes the client render the same way and takes the parked statics off the page", () => {
    const server = new SlotIndex()
    server.scan(mount(fixture.rendered, fixture))
    const serverSlots = [...found(server, fixture.file).keys()].sort()

    const host = mount(fixture.client, fixture)
    index.scan(host)

    expect([...found(index, fixture.file).keys()].sort()).toEqual(serverSlots)
    expect(host.querySelector("template[data-herb-region]")).toBeNull()
  })

  test("carries the version the payload names", () => {
    index.scan(mount(fixture.rendered, fixture))

    for (const region of index.regionsFor(fixture.file)) {
      expect(region.version).toBe(fixture.values.version)
      expect(region.version).toBe(fixture.schema.version)
    }
  })

  test("becomes the server's next render when the values land on the client render", () => {
    const host = mount(fixture.client, fixture)
    index.scan(host)

    const report = index.apply(fixture.values)

    expect(report.deferred).toEqual([])
    expect(host.innerHTML).toBe(serialized(fixture.expected))
  })

  test("becomes the server's next render on the server render, or defers only what needs parked markup", () => {
    const host = mount(fixture.rendered, fixture)
    index.scan(host)

    const report = index.apply(fixture.values)

    if (report.deferred.length === 0) {
      expect(host.innerHTML).toBe(serialized(fixture.expected))
    } else {
      for (const deferred of report.deferred) {
        expect(PARKED_REASONS).toContain(deferred.reason)
      }
    }
  })

  test("is unchanged by applying the same values a second time", () => {
    const host = mount(fixture.client, fixture)
    index.scan(host)
    index.apply(fixture.values)

    const settled = host.innerHTML

    index.apply(fixture.values)

    expect(host.innerHTML).toBe(settled)
  })

  test("can be indexed again from what it became", () => {
    const host = mount(fixture.client, fixture)
    index.scan(host)
    index.apply(fixture.values)

    const again = new SlotIndex()
    again.scan(host)

    expect([...found(again, fixture.file).keys()].sort()).toEqual([...found(index, fixture.file).keys()].sort())
  })

  test("is described by a dependency map that names only slots the compiler recorded", () => {
    for (const entries of Object.values(fixture.dependencies.state)) {
      for (const entry of entries) {
        expect(entry.file).toBe(fixture.file)
        expect(entry.version).toBe(fixture.schema.version)
        expect(schema.has(entry.index), `the map names slot ${entry.index}, which the schema does not have`).toBe(true)
      }
    }
  })
})
