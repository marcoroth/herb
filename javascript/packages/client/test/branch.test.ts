import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex, SLOT_EVENT } from "../src/slot-index"
import type { SlotEventDetail } from "../src/slot-index"

function nth(html: string, occurrence: number): string {
  return html.replace(/(<!--herb-region:[^>]*?:[0-9a-f]{8}):\d+-->/g, `$1:${occurrence}-->`)
}

const FILE = "app/views/posts/index.html.erb"
const EMPTY_COND = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`

describe("a branch whose markup was never in the DOM", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  test("an untaken conditional holds an addressable but empty position", () => {
    const index = new SlotIndex()
    document.body.innerHTML = EMPTY_COND
    index.scan(document.body)

    const slot = index.slot(FILE, 0)!

    expect(slot.type).toBe("conditional")
    expect(slot.branch).toBeNull()
    expect(index.rangeFor(slot).toString()).toBe("")
    expect(index.descendantsOf(slot)).toEqual([])
  })

  test("the branch's own markers arrive with its html and become addressable", () => {
    const index = new SlotIndex()
    document.body.innerHTML = EMPTY_COND
    index.scan(document.body)

    const slot = index.slot(FILE, 0)!

    index.update(slot, `<!--herb-branch:0:1--><b><!--herb-slot:3-->secret<!--/herb-slot:3--></b>`)

    expect(index.slot(FILE, 3)?.type).toBe("child")
    expect(index.rangeFor(index.slot(FILE, 3)!).toString()).toBe("secret")
    expect(index.slot(FILE, 3)?.parent).toBe(slot)
    expect(index.slot(FILE, 0)?.branch).toBe(1)
  })
})

describe("markup parked in a template", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  test("does not index slots inside a template element", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `
      <!--herb-region:${FILE}:aaaaaaaa:0-->
      <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
      <template data-herb-statics="${FILE}">
        <!--herb-branch:0:1--><b><!--herb-slot:3--><!--/herb-slot:3--></b>
      </template>
      <!--/herb-region:${FILE}-->
    `

    index.scan(document.body)

    expect(index.slot(FILE, 0)?.type).toBe("conditional")
    expect(index.slot(FILE, 3), "the parked branch must not be addressable").toBeNull()
    expect(index.descendantsOf(index.slot(FILE, 0)!)).toEqual([])
  })

  test("becomes addressable once the parked markup is moved into the document", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `
      <!--herb-region:${FILE}:aaaaaaaa:0-->
      <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
      <template data-herb-statics="0:1"><!--herb-branch:0:1--><b><!--herb-slot:3-->secret<!--/herb-slot:3--></b></template>
      <!--/herb-region:${FILE}-->
    `

    index.scan(document.body)
    expect(index.slot(FILE, 3)).toBeNull()

    const skeleton = index.skeletonFor(FILE, "0:1")!.cloneNode(true) as DocumentFragment
    const range = index.rangeFor(index.slot(FILE, 0)!)

    range.insertNode(skeleton)
    index.scan(document.body)

    expect(index.slot(FILE, 3)?.type).toBe("child")
    expect(index.rangeFor(index.slot(FILE, 3)!).toString()).toBe("secret")
  })
})

describe("a skeleton once it has been read", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const page = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><template data-herb-statics="0:1"><!--herb-branch:0:1--><b>Hello</b></template><!--/herb-region:${FILE}-->`

  test("leaves the document, and leaves the rendered markers alone", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    expect(document.querySelector("template")).toBeNull()
    expect(index.slot(FILE, 0)?.type).toBe("conditional")
    expect(index.regionsFor(FILE)).toHaveLength(1)
    expect(index.skeletonFor(FILE, "0:1")?.textContent).toBe("Hello")
  })

  test("cannot be copied into the page by an update that spans it", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    const region = index.regionsFor(FILE)[0]
    const range = document.createRange()

    range.setStartAfter(region.start!)
    range.setEndBefore(region.end!)

    expect(range.cloneContents().querySelector("template")).toBeNull()
  })

  test("stays registered when the rendering that carried it is replaced", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    document.body.innerHTML = page
    index.prune()
    index.scan(document.body)

    expect(document.querySelector("template")).toBeNull()
    expect(index.materialize(FILE, "0:1")?.textContent).toBe("Hello")
  })
})

describe("rendering a branch that never rendered, without a round trip", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const page = `
    <!--herb-region:${FILE}:aaaaaaaa:0-->
    <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
    <template data-herb-statics="0:1"><!--herb-branch:0:1--><b>Hello <!--herb-slot:3--><!--/herb-slot:3--></b></template>
    <!--/herb-region:${FILE}-->
  `

  test("parks the skeleton without making it addressable", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    expect(index.skeletonKeys(FILE)).toEqual(["0:1"])
    expect(index.slot(FILE, 3)).toBeNull()
  })

  test("builds the branch from the skeleton and the values alone", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    const built = index.materialize(FILE, "0:1", { 3: "Marco" })!

    index.update(index.slot(FILE, 0)!, "")
    index.rangeFor(index.slot(FILE, 0)!).insertNode(built)
    index.scan(document.body)

    expect(document.querySelector("b")?.textContent).toBe("Hello Marco")
    expect(index.slot(FILE, 3)?.type).toBe("child")
    expect(index.slot(FILE, 0)?.branch).toBe(1)
  })

  test("keeps one copy of a skeleton however many times the template rendered", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page + nth(page, 1) + nth(page, 2)
    index.scan(document.body)

    expect(index.regionsFor(FILE)).toHaveLength(3)
    expect(index.skeletonKeys(FILE)).toEqual(["0:1"])
  })

  test("leaves a slot alone when the server said nothing about it", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    const built = index.materialize(FILE, "0:1", {})!

    expect(built.textContent).toContain("Hello")
  })
})

describe("a page where the server chose a different format per template", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const OTHER = "app/views/posts/_row.html.erb"

  const withStatics = `
    <!--herb-region:${FILE}:aaaaaaaa:0-->
    <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
    <template data-herb-statics="0:1"><!--herb-branch:0:1--><b>Hello</b></template>
    <!--/herb-region:${FILE}-->
  `

  const withoutStatics = `
    <!--herb-region:${OTHER}:bbbbbbbb:0-->
    <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
    <!--/herb-region:${OTHER}-->
  `

  test("reports what a template sent, so a caller knows whether to ask the server", () => {
    const index = new SlotIndex()
    document.body.innerHTML = withStatics + withoutStatics
    index.scan(document.body)

    expect(index.renderModeFor(FILE)).toBe("client")
    expect(index.renderModeFor(OTHER)).toBe("server")
    expect(index.materialize(OTHER, "0:1")).toBeNull()
  })

  test("reports a template the index has never seen as server-rendered", () => {
    const index = new SlotIndex()

    expect(index.renderModeFor("app/views/nothing.html.erb")).toBe("server")
  })

  test("answers per slot, so one template can be both", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `
      <!--herb-region:${FILE}:aaaaaaaa:0-->
      <div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>
      <div><!--herb-slot:7:conditional--><!--/herb-slot:7--></div>
      <template data-herb-statics="0:1"><!--herb-branch:0:1--><b>public</b></template>
      <!--/herb-region:${FILE}-->
    `

    index.scan(document.body)

    expect(index.renderModeFor(FILE, 0)).toBe("client")
    expect(index.renderModeFor(FILE, 7)).toBe("server")
    expect(index.branchesFor(FILE, 7)).toEqual([])
  })

  test("takes statics as they arrive rather than as the whole set", () => {
    const index = new SlotIndex()
    document.body.innerHTML = withStatics
    index.scan(document.body)

    expect(index.branchesFor(FILE, 0)).toEqual([1])

    const later = document.createElement("div")

    later.innerHTML = `
      <!--herb-region:${FILE}:aaaaaaaa:0-->
      <template data-herb-statics="0:2"><!--herb-branch:0:2--><i>Goodbye</i></template>
      <!--/herb-region:${FILE}-->
    `

    document.body.append(later)
    index.scan(later)

    expect(index.branchesFor(FILE, 0)).toEqual([1, 2])
    expect(index.materialize(FILE, "0:2")?.textContent).toBe("Goodbye")
  })

  test("drops what an older version of a template parked", () => {
    const index = new SlotIndex()
    document.body.innerHTML = withStatics
    index.scan(document.body)

    const next = document.createElement("div")

    next.innerHTML = `
      <!--herb-region:${FILE}:cccccccc:0-->
      <template data-herb-statics="0:2"><!--herb-branch:0:2--><i>Goodbye</i></template>
      <!--/herb-region:${FILE}-->
    `

    document.body.append(next)
    index.scan(next)

    expect(index.skeletonKeys(FILE)).toEqual(["0:2"])
    expect(index.materialize(FILE, "0:1")).toBeNull()
  })

  test("keeps statics when the rendering that carried them leaves the page", () => {
    const index = new SlotIndex()
    document.body.innerHTML = withStatics
    index.scan(document.body)

    document.body.innerHTML = ""
    index.prune()

    expect(index.regionsFor(FILE)).toEqual([])
    expect(index.renderModeFor(FILE)).toBe("client")

    index.clear()

    expect(index.renderModeFor(FILE)).toBe("server")
  })
})

describe("statics parked once for the page", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const OTHER = "app/views/posts/_row.html.erb"

  const bundle = `
    <template data-herb-region="${FILE}:aaaaaaaa">
      <!--herb-branch:0:1--><b>Hello <!--herb-slot:3--><!--/herb-slot:3--></b>
      <!--herb-branch:0:2--><i>Goodbye</i>
      <!--herb-branch:7:1--><span>admin</span>
    </template>
  `

  const rendering = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`

  test("belongs to the template it names rather than to where it sits", () => {
    const index = new SlotIndex()
    document.body.innerHTML = rendering + nth(rendering, 1) + nth(rendering, 2) + bundle
    index.scan(document.body)

    expect(index.regionsFor(FILE)).toHaveLength(3)
    expect(index.skeletonKeys(FILE)).toEqual(["0:1", "0:2", "7:1"])
    expect(document.querySelector("template")).toBeNull()
  })

  test("takes the keys from the payload, so nothing can disagree with it", () => {
    const index = new SlotIndex()
    document.body.innerHTML = bundle
    index.scan(document.body)

    expect(index.branchesFor(FILE, 0)).toEqual([1, 2])
    expect(index.branchesFor(FILE, 7)).toEqual([1])
    expect(index.materialize(FILE, "0:2")?.textContent?.trim()).toBe("Goodbye")
  })

  test("carries the branch marker into what it builds, so the slot knows its branch", () => {
    const index = new SlotIndex()
    document.body.innerHTML = rendering + bundle
    index.scan(document.body)

    const built = index.materialize(FILE, "0:1", { 3: "Marco" })!

    index.rangeFor(index.slot(FILE, 0)!).insertNode(built)
    index.scan(document.body)

    expect(document.querySelector("b")?.textContent).toBe("Hello Marco")
    expect(index.slot(FILE, 0)?.branch).toBe(1)
  })

  test("is indexed without any rendering of its template on the page", () => {
    const index = new SlotIndex()
    document.body.innerHTML = bundle
    index.scan(document.body)

    expect(index.regionsFor(FILE)).toEqual([])
    expect(index.renderModeFor(FILE)).toBe("client")
    expect(index.renderModeFor(OTHER)).toBe("server")
  })

  test("is ignored when it names nothing that can be read as a region", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<template data-herb-region="no-version-here"><!--herb-branch:0:1--><b>x</b></template>`
    index.scan(document.body)

    expect(index.skeletonKeys("no-version-here")).toEqual([])
    expect(document.querySelector("template"), "an unreadable one is left alone").not.toBeNull()
  })

  test("still accepts one branch named by attribute, inside its region", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${FILE}:aaaaaaaa:0--><template data-herb-statics="0:1"><!--herb-branch:0:1--><b>Hello</b></template><!--/herb-region:${FILE}-->`
    index.scan(document.body)

    expect(index.skeletonKeys(FILE)).toEqual(["0:1"])
  })
})

describe("output the compiler actually emits", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const VIEW = "app/views/test.html.erb"

  test("an untaken if branch, with the else that rendered not parked beside it", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:73338818:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><i>guest</i><!--/herb-slot:0--></div><!--/herb-region:${VIEW}--><template data-herb-region="${VIEW}:73338818"><!--herb-branch:0:0--><b>Hi <!--herb-slot:1--><!--/herb-slot:1--></b></template>`

    index.scan(document.body)

    expect(index.slot(VIEW, 0)?.branch).toBe(1)
    expect(index.skeletonKeys(VIEW)).toEqual(["0:0"])
    expect(index.renderModeFor(VIEW, 0)).toBe("client")
    expect(index.materialize(VIEW, "0:1")).toBeNull()

    const slot = index.slot(VIEW, 0)!
    const built = index.materialize(VIEW, "0:0", { 1: "Marco" })!

    index.update(slot, "")
    index.rangeFor(slot).insertNode(built)
    index.scan(document.body)

    expect(document.querySelector("div")?.textContent).toBe("Hi Marco")
    expect(index.slot(VIEW, 0)?.branch).toBe(0)
    expect(index.slot(VIEW, 1)?.type).toBe("child")
  })

  test("a conditional nested in a branch, parked on its own", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:bf795402:0--><p><!--herb-slot:0:conditional--><!--/herb-slot:0--></p><!--/herb-region:${VIEW}--><template data-herb-region="${VIEW}:bf795402"><!--herb-branch:0:0--><!--herb-slot:1:conditional--><!--/herb-slot:1-->outer<!--herb-branch:1:0-->deep</template>`

    index.scan(document.body)

    expect(index.skeletonKeys(VIEW)).toEqual(["0:0", "1:0"])

    index.rangeFor(index.slot(VIEW, 0)!).insertNode(index.materialize(VIEW, "0:0")!)
    index.scan(document.body)

    expect(document.querySelector("p")?.textContent).toBe("outer")
    expect(index.slot(VIEW, 1)?.type, "the inner conditional is a slot of its own now").toBe("conditional")

    index.rangeFor(index.slot(VIEW, 1)!).insertNode(index.materialize(VIEW, "1:0")!)
    index.scan(document.body)

    expect(document.querySelector("p")?.textContent).toBe("deepouter")
    expect(index.slot(VIEW, 1)?.branch).toBe(0)
  })

  test("an attribute slot and a child slot inside a parked branch", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:cf7db90d:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${VIEW}--><template data-herb-region="${VIEW}:cf7db90d"><!--herb-branch:0:0--><span class="" data-herb-slot="1:attribute:class 2:child"></span></template>`

    index.scan(document.body)
    index.rangeFor(index.slot(VIEW, 0)!).insertNode(index.materialize(VIEW, "0:0")!)
    index.scan(document.body)

    const attribute = index.slot(VIEW, 1)!
    const child = index.slot(VIEW, 2)!

    expect(attribute.type).toBe("attribute")
    expect(attribute.attribute, "the marker says which attribute the slot is").toBe("class")
    expect(child.type).toBe("child")

    index.setAttribute(attribute, "row")
    index.update(child, "Marco")

    expect(document.querySelector("span")?.getAttribute("class")).toBe("row")
    expect(document.querySelector("span")?.textContent).toBe("Marco")
  })
})

describe("keeping a branch that rendered", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const VIEW = "app/views/test.html.erb"

  test("keeps a copy of it, ready to build again", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><i>Hi <!--herb-slot:1-->Marco<!--/herb-slot:1--></i><!--/herb-slot:0--></div><!--/herb-region:${VIEW}-->`
    index.scan(document.body)

    const slot = index.slot(VIEW, 0)!

    expect(index.materialize(VIEW, "0:1")).toBeNull()
    expect(index.capture(slot)).toBe(true)
    expect(index.skeletonKeys(VIEW)).toEqual(["0:1"])

    index.update(slot, "")

    const built = index.materialize(VIEW, "0:1", { 1: "Alice" })!

    index.rangeFor(index.slot(VIEW, 0)!).insertNode(built)
    index.scan(document.body)

    expect(document.querySelector("i")?.textContent).toBe("Hi Alice")
    expect(index.slot(VIEW, 0)?.branch).toBe(1)
  })

  test("takes the values out of the copy, so nothing stale can come back", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><span class="on" data-herb-slot="1:attribute:class 2:child">Marco</span><!--/herb-slot:0--></div><!--/herb-region:${VIEW}-->`
    index.scan(document.body)
    index.capture(index.slot(VIEW, 0)!)

    const skeleton = index.skeletonFor(VIEW, "0:1")!

    expect(skeleton.textContent).toBe("")
    expect(skeleton.querySelector("span")?.getAttribute("class")).toBe("")
  })

  test("empties a slot inside a slot without tripping over what went with it", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><p><!--herb-slot:1--><b><!--herb-slot:2-->deep<!--/herb-slot:2--></b><!--/herb-slot:1--></p><!--/herb-slot:0--></div><!--/herb-region:${VIEW}-->`
    index.scan(document.body)
    index.capture(index.slot(VIEW, 0)!)

    const skeleton = index.skeletonFor(VIEW, "0:1")!

    expect(skeleton.textContent).toBe("")
    expect(skeleton.querySelector("p"), "the markup around the slot stays").not.toBeNull()
    expect(skeleton.querySelector("b"), "what the slot held goes").toBeNull()
  })

  test("defers to what the server parked", () => {
    const index = new SlotIndex()

    document.body.innerHTML = `<!--herb-region:${VIEW}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><i>from the page</i><!--/herb-slot:0--></div><!--/herb-region:${VIEW}--><template data-herb-region="${VIEW}:aaaaaaaa"><!--herb-branch:0:1--><i>from the server</i></template>`
    index.scan(document.body)

    expect(index.capture(index.slot(VIEW, 0)!)).toBe(false)
    expect(index.materialize(VIEW, "0:1")?.textContent).toBe("from the server")
  })

  test("has nothing to keep for a slot that is showing no branch", () => {
    const index = new SlotIndex()

    document.body.innerHTML = EMPTY_COND
    index.scan(document.body)

    expect(index.capture(index.slot(FILE, 0)!)).toBe(false)
    expect(index.skeletonKeys(FILE)).toEqual([])
  })
})

describe("switching a branch from the client", () => {
  beforeEach(() => { document.body.innerHTML = "" })

  const page = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:1--><b>under</b><!--/herb-slot:0--></div><template data-herb-statics="0:0"><!--herb-branch:0:0--><i>over</i></template><!--/herb-region:${FILE}-->`

  function watch(): SlotEventDetail[] {
    const seen: SlotEventDetail[] = []

    document.addEventListener(SLOT_EVENT, (event) => seen.push((event as CustomEvent<SlotEventDetail>).detail))

    return seen
  }

  test("builds the parked branch and says it was a branch that changed", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    const slot = index.slot(FILE, 0)!
    const seen = watch()

    expect(index.switchBranch(slot, 0)).toBe(true)

    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("over")
    expect(index.slot(FILE, 0)?.branch).toBe(0)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ file: FILE, index: 0, operation: "branch" })
  })

  test("parks what it replaces, so switching back needs nothing new", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    index.switchBranch(index.slot(FILE, 0)!, 0)

    expect(index.branchesFor(FILE, 0).sort()).toEqual([0, 1])
    expect(index.switchBranch(index.slot(FILE, 0)!, 1)).toBe(true)
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("under")
  })

  test("does nothing when the branch it is asked for is the one already shown", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    const seen = watch()

    expect(index.switchBranch(index.slot(FILE, 0)!, 1)).toBe(false)
    expect(seen).toHaveLength(0)
  })

  test("reports that it could not, when the branch was never parked", () => {
    const index = new SlotIndex()
    document.body.innerHTML = page
    index.scan(document.body)

    expect(index.switchBranch(index.slot(FILE, 0)!, 7)).toBe(false)
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("under")
  })
})
