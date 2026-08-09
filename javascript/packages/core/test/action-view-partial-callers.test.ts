import { describe, expect, test } from "vitest"

import { PartialCallerIndex } from "../src/action-view-partial-callers.js"

import type { PartialCallSite } from "../src/action-view-partial-callers.js"

const CARD = "app/views/posts/_card.html.erb"
const BADGE = "app/views/posts/_badge.html.erb"
const INDEX = "app/views/posts/index.html.erb"
const SHOW = "app/views/posts/show.html.erb"

function callSite(caller: string, ancestors: string[] = []): PartialCallSite {
  return { caller, locals: [], ancestors, via: "render" }
}

function index(callSites: Record<string, PartialCallSite[]>, documentRoots: string[] = []): PartialCallerIndex {
  return new PartialCallerIndex(new Map(Object.entries(callSites)), new Set(documentRoots), new Map(), new Set())
}

describe("PartialCallerIndex", () => {
  describe("replaceCallsFrom", () => {
    test("clears the unresolved renders the caller previously contributed", () => {
      const callers = new PartialCallerIndex(new Map(), new Set(), new Map([[INDEX, 2]]), new Set())

      expect(callers.isComplete).toBe(false)
      expect(callers.unresolvedRenderCount).toBe(2)

      callers.replaceCallsFrom(INDEX, new Map())

      expect(callers.unresolvedRenderCount).toBe(0)
      expect(callers.isComplete).toBe(true)
    })

    test("replaces the unresolved count rather than adding to it", () => {
      const callers = new PartialCallerIndex(new Map(), new Set(), new Map([[INDEX, 2]]), new Set())

      callers.replaceCallsFrom(INDEX, new Map(), 1)

      expect(callers.unresolvedRenderCount).toBe(1)
    })

    test("leaves the unresolved renders of other callers alone", () => {
      const callers = new PartialCallerIndex(new Map(), new Set(), new Map([[INDEX, 2], [SHOW, 3]]), new Set())

      callers.replaceCallsFrom(INDEX, new Map())

      expect(callers.unresolvedRenderCount).toBe(3)
    })

    test("drops the call sites the caller previously contributed", () => {
      const callers = index({ [CARD]: [callSite(INDEX), callSite(SHOW)] })

      expect(callers.replaceCallsFrom(INDEX, new Map())).toBe(true)
      expect(callers.callersOf(CARD)).toEqual([callSite(SHOW)])
    })

    test("removes the partial entirely once its last caller goes", () => {
      const callers = index({ [CARD]: [callSite(INDEX)] })

      expect(callers.replaceCallsFrom(INDEX, new Map())).toBe(true)
      expect(callers.callersOf(CARD)).toEqual([])
      expect(callers.size).toBe(0)
    })

    test("adds the call sites the caller now contributes", () => {
      const callers = index({ [CARD]: [callSite(SHOW)] })

      callers.replaceCallsFrom(INDEX, new Map([[CARD, [callSite(INDEX)]]]))

      expect(callers.callersOf(CARD)).toEqual([callSite(SHOW), callSite(INDEX)])
    })

    test("moves a caller from one partial to another", () => {
      const callers = index({ [CARD]: [callSite(INDEX)] })

      callers.replaceCallsFrom(INDEX, new Map([[BADGE, [callSite(INDEX)]]]))

      expect(callers.callersOf(CARD)).toEqual([])
      expect(callers.callersOf(BADGE)).toEqual([callSite(INDEX)])
    })

    test("indexes a caller the index had never seen", () => {
      const callers = index({})

      expect(callers.replaceCallsFrom(INDEX, new Map([[CARD, [callSite(INDEX)]]]))).toBe(true)
      expect(callers.callersOf(CARD)).toEqual([callSite(INDEX)])
    })

    test("reports no change when the caller had and has no call sites", () => {
      const callers = index({ [CARD]: [callSite(SHOW)] })

      expect(callers.replaceCallsFrom(INDEX, new Map())).toBe(false)
      expect(callers.callersOf(CARD)).toEqual([callSite(SHOW)])
    })

    test("leaves other callers of the same partial alone", () => {
      const callers = index({ [CARD]: [callSite(INDEX), callSite(SHOW)] })

      callers.replaceCallsFrom(INDEX, new Map([[CARD, [callSite(INDEX, ["div"])]]]))

      expect(callers.callersOf(CARD)).toEqual([callSite(SHOW), callSite(INDEX, ["div"])])
    })

    test("invalidates the cached context of the partials it touched", () => {
      const callers = index({ [CARD]: [callSite(INDEX, ["main"])] }, [INDEX])

      expect(callers.contextOf(CARD).chains[0].tags).toEqual(["main"])

      callers.replaceCallsFrom(INDEX, new Map([[CARD, [callSite(INDEX, ["aside"])]]]))

      expect(callers.contextOf(CARD).chains[0].tags).toEqual(["aside"])
    })
  })

  describe("removeCallsTo", () => {
    test("forgets every caller of a deleted partial", () => {
      const callers = index({ [CARD]: [callSite(INDEX)], [BADGE]: [callSite(SHOW)] })

      expect(callers.removeCallsTo(CARD)).toBe(true)
      expect(callers.callersOf(CARD)).toEqual([])
      expect(callers.callersOf(BADGE)).toEqual([callSite(SHOW)])
    })

    test("reports no change for a partial it never indexed", () => {
      const callers = index({ [CARD]: [callSite(INDEX)] })

      expect(callers.removeCallsTo(BADGE)).toBe(false)
    })

    test("invalidates the cached context of the removed partial", () => {
      const callers = index({ [CARD]: [callSite(INDEX, ["main"])] }, [INDEX])

      expect(callers.contextOf(CARD).resolved).toBe(true)

      callers.removeCallsTo(CARD)

      expect(callers.contextOf(CARD).resolved).toBe(false)
    })
  })

  describe("ancestor class context", () => {
    test("preserves ancestor classes through serialization", () => {
      const callers = index({
        [CARD]: [{
          caller: INDEX,
          locals: [],
          ancestors: ["main", "div"],
          ancestorAttributes: [{}, { class: "sr-only" }],
          via: "render",
        }],
      }, [INDEX])

      const restored = PartialCallerIndex.from(structuredClone(callers.toJSON()))
      const [chain] = restored.contextOf(CARD).chains

      expect(chain.tags).toEqual(["main", "div"])
      expect(chain.attributes).toEqual([{}, { class: "sr-only" }])
      expect(chain.frames[0].ancestorAttributes).toEqual([{}, { class: "sr-only" }])
    })

    test("keeps call sites with the same tags but different classes distinct", () => {
      const callers = index({
        [CARD]: [
          { caller: INDEX, locals: [], ancestors: ["div"], ancestorAttributes: [{ class: "sr-only" }] },
          { caller: INDEX, locals: [], ancestors: ["div"] },
        ],
      }, [INDEX])

      expect(callers.contextOf(CARD).chains).toHaveLength(2)
    })
  })
})
