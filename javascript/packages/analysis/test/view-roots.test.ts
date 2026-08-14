import { describe, test, expect } from "vitest"

import {
  partialNameForRoots,
  relativeToViewRoots,
  resolvePartial,
  rootIndexFor,
  templateNameForRoots,
} from "../src/partial-resolution"

import type { PartialPaths } from "../src/partial-resolution"

const APP = "app/views"
const ENGINE = "engines/billing/app/views"
const ROOTS = [APP, ENGINE]

describe("relativeToViewRoots", () => {
  test("returns the first root that contains the file", () => {
    expect(relativeToViewRoots(`${APP}/home/index.html.erb`, ROOTS)).toEqual([0, "home/index.html.erb"])
    expect(relativeToViewRoots(`${ENGINE}/billing/_invoice.html.erb`, ROOTS)).toEqual([1, "billing/_invoice.html.erb"])
  })

  test("returns null when no root contains the file", () => {
    expect(relativeToViewRoots("lib/elsewhere/_thing.html.erb", ROOTS)).toBeNull()
  })
})

describe("partialNameForRoots", () => {
  test("names a partial from a secondary view root", () => {
    expect(partialNameForRoots(`${ENGINE}/billing/_invoice.html.erb`, ROOTS)).toBe("billing/invoice")
  })

  test("names a partial from the primary view root", () => {
    expect(partialNameForRoots(`${APP}/shared/_header.html.erb`, ROOTS)).toBe("shared/header")
  })

  test("returns null for a file outside every root", () => {
    expect(partialNameForRoots("lib/_thing.html.erb", ROOTS)).toBeNull()
  })
})

describe("templateNameForRoots", () => {
  test("names a template from a secondary view root", () => {
    expect(templateNameForRoots(`${ENGINE}/billing/index.html.erb`, ROOTS)).toBe("billing/index")
  })
})

describe("rootIndexFor", () => {
  test("orders an earlier view root ahead of a later one", () => {
    expect(rootIndexFor(`${APP}/billing/_invoice.html.erb`, ROOTS)).toBe(0)
    expect(rootIndexFor(`${ENGINE}/billing/_invoice.html.erb`, ROOTS)).toBe(1)
  })

  test("sorts an unknown file last", () => {
    expect(rootIndexFor("lib/_thing.html.erb", ROOTS)).toBe(ROOTS.length)
  })
})

describe("resolvePartial", () => {
  test("resolves a sibling within the root that owns the caller", () => {
    const index: PartialPaths = new Map([["billing/row", `${ENGINE}/billing/_row.html.erb`]])
    const caller = `${ENGINE}/billing/index.html.erb`

    expect(resolvePartial("row", caller, index, ROOTS)).toBe(`${ENGINE}/billing/_row.html.erb`)
  })

  test("resolves with a single root", () => {
    const index: PartialPaths = new Map([["shared/header", `${APP}/shared/_header.html.erb`]])

    expect(resolvePartial("shared/header", "", index, [APP])).toBe(`${APP}/shared/_header.html.erb`)
  })
})
