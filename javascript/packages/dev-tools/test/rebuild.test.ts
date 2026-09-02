import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { Runtime } from "@herb-tools/client"

import { rebindRegion } from "../src/dev-server/rebind"
import { rebuildRegion, stateOwnedIndices } from "../src/dev-server/rebuild"

const FILE = "app/views/posts/index.html.erb"

function mount(html: string): Runtime {
  document.body.innerHTML = html

  return Runtime.start()
}

function regionMarkup(version: string, inner: string): string {
  return `<!--herb-region:${FILE}:${version}:0-->${inner}<!--/herb-region:${FILE}-->`
}

beforeEach(() => {
  document.body.innerHTML = ""
})

afterEach(() => {
  Runtime.get()?.stop()
  document.body.innerHTML = ""
})

describe("rebindRegion", () => {
  test("moves a region to a new version in place", () => {
    const runtime = mount(regionMarkup("aaaaaaaa", "<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p>"))
    const region = runtime.slots.regionsFor(FILE)[0]

    expect(rebindRegion(runtime, region, "bbbbbbbb")).toBe(true)
    expect(region.version).toBe("bbbbbbbb")
    expect(document.body.innerHTML).toContain(`herb-region:${FILE}:bbbbbbbb:0`)
    expect(document.body.textContent).toContain("Marco")
  })

  test("a rebound region accepts a payload at the new version", () => {
    const runtime = mount(regionMarkup("aaaaaaaa", "<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p>"))
    const region = runtime.slots.regionsFor(FILE)[0]

    const before = runtime.slots.apply({ template: FILE, version: "bbbbbbbb", occurrence: 0, slots: { 0: "Kim" } })

    expect(before.deferred.map((deferral) => deferral.reason)).toContain("stale-version")

    rebindRegion(runtime, region, "bbbbbbbb")

    const after = runtime.slots.apply({ template: FILE, version: "bbbbbbbb", occurrence: 0, slots: { 0: "Kim" } })

    expect(after.applied).toBe(1)
    expect(document.body.textContent).toContain("Kim")
  })
})

describe("rebuildRegion", () => {
  test("rebuilds from static markup and restores the captured value", () => {
    const runtime = mount(regionMarkup("aaaaaaaa", "Hello, <!--herb-slot:0-->Marco<!--/herb-slot:0-->"))
    const region = runtime.slots.regionsFor(FILE)[0]

    const result = rebuildRegion(runtime, {
      region,
      version: "bbbbbbbb",
      staticMarkup: "<p>Hello, <!--herb-slot:0--><!--/herb-slot:0--></p>",
      remap: { "0": 0 },
    })

    expect(result).not.toBeNull()
    expect(result?.restored).toBe(1)
    expect(document.querySelector("p")?.textContent).toBe("Hello, Marco")
    expect(runtime.slots.regionsFor(FILE)).toHaveLength(1)
    expect(runtime.slots.regionsFor(FILE)[0].version).toBe("bbbbbbbb")
  })

  test("drops a value whose slot the edit removed", () => {
    const runtime = mount(
      regionMarkup(
        "aaaaaaaa",
        "<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p><p><!--herb-slot:1-->marco@example.com<!--/herb-slot:1--></p>"
      )
    )
    const region = runtime.slots.regionsFor(FILE)[0]

    const result = rebuildRegion(runtime, {
      region,
      version: "bbbbbbbb",
      staticMarkup: "<p><!--herb-slot:0--><!--/herb-slot:0--></p>",
      remap: { "0": 0, "1": null },
    })

    expect(result?.restored).toBe(1)
    expect(result?.dropped).toEqual([1])
    expect(document.body.textContent).not.toContain("example.com")
  })

  test("a shifted index lands where the remap says", () => {
    const runtime = mount(regionMarkup("aaaaaaaa", "<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p>"))
    const region = runtime.slots.regionsFor(FILE)[0]

    const result = rebuildRegion(runtime, {
      region,
      version: "bbbbbbbb",
      staticMarkup: "<!--herb-slot:0--><!--/herb-slot:0--><p><!--herb-slot:1--><!--/herb-slot:1--></p>",
      remap: { "0": 1 },
    })

    expect(result?.restored).toBe(1)
    expect(document.querySelector("p")?.textContent).toBe("Marco")
  })

  test("keeps the unsaved value of an input across the rebuild", () => {
    const runtime = mount(
      regionMarkup("aaaaaaaa", '<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p><input name="draft" value="original">')
    )

    const input = document.querySelector("input") as HTMLInputElement

    input.value = "unsaved words"
    input.focus()

    const region = runtime.slots.regionsFor(FILE)[0]

    const result = rebuildRegion(runtime, {
      region,
      version: "bbbbbbbb",
      staticMarkup: '<p><!--herb-slot:0--><!--/herb-slot:0--></p><input name="draft" value="original">',
      remap: { "0": 0 },
    })

    expect(result).not.toBeNull()

    const rebuilt = document.querySelector("input") as HTMLInputElement

    expect(rebuilt.value).toBe("unsaved words")
    expect(document.activeElement).toBe(rebuilt)
  })

  test("a payload applies after the rebuild where it deferred before", () => {
    const runtime = mount(regionMarkup("aaaaaaaa", "<p><!--herb-slot:0-->Marco<!--/herb-slot:0--></p>"))
    const region = runtime.slots.regionsFor(FILE)[0]

    rebuildRegion(runtime, {
      region,
      version: "bbbbbbbb",
      staticMarkup: "<p><!--herb-slot:0--><!--/herb-slot:0--></p>",
      remap: { "0": 0 },
    })

    const report = runtime.slots.apply({ template: FILE, version: "bbbbbbbb", occurrence: 0, slots: { 0: "Kim" } })

    expect(report.applied).toBe(1)
    expect(document.body.textContent).toContain("Kim")
  })
})

describe("stateOwnedIndices", () => {
  test("collects reads, conditionals, presence and computed indices", () => {
    const owned = stateOwnedIndices({
      reads: { count: [0, 2] },
      conditionals: { "3": { arms: [], else: null } },
      presence: { "4": ["count", { value: 0 }] },
      computed: { "5": ["count", { value: 0 }] },
    })

    expect([...owned].sort()).toEqual([0, 2, 3, 4, 5])
  })

  test("answers empty for a template without states", () => {
    expect(stateOwnedIndices(null).size).toBe(0)
  })
})
