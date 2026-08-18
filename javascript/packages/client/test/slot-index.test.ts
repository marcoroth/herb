import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import type { Row } from "../src/slot-index"
import { HerbRuntime } from "../src/runtime"

const FILE = "app/views/posts/index.html.erb"

const CHILD = `<!--herb-region:${FILE}:25c0946e:0--><p>Hi <!--herb-slot:0-->Marco<!--/herb-slot:0-->!</p><!--/herb-region:${FILE}-->`
const ANCHORED = `<!--herb-region:${FILE}:fd3dfd36:0--><span class="n" data-herb-child="0">Marco</span><!--/herb-region:${FILE}-->`
const COND_TRUE = `<!--herb-region:${FILE}:a6ef770d:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0--><b>x</b><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const COND_FALSE = `<!--herb-region:${FILE}:a6ef770d:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const COLLECTION = `<!--herb-region:${FILE}:64652ac4:0--><!--herb-slot:0:collection--><!--herb-row:0:1--><li id="1" data-herb-slot="1:attribute" data-herb-child="2">1</li><!--/herb-row:0--><!--herb-row:0:2--><li id="2" data-herb-slot="1:attribute" data-herb-child="2">2</li><!--/herb-row:0--><!--/herb-slot:0--><!--/herb-region:${FILE}-->`
const TABLE = `<!--herb-region:${FILE}:c4a38ea8:0--><table><!--herb-slot:0:collection--><!--herb-row:0:1--><tr id="1" data-herb-slot="1:attribute"><td data-herb-child="2">1</td></tr><!--/herb-row:0--><!--/herb-slot:0--></table><!--/herb-region:${FILE}-->`
const DISPLACED =
  `<!--herb-region:${FILE}:25c0946e:0--><h1 data-herb-child="5">Title</h1><!--/herb-region:${FILE}-->` +
  `<!--herb-region:${FILE}:25c0946e:0--><p data-herb-child="0">body</p><!--/herb-region:${FILE}-->`
const ATTR = `<!--herb-region:${FILE}:55167514:0--><div class="card" id="1" data-herb-slot="0:attribute,1:element">x</div><!--/herb-region:${FILE}-->`

function occurrence(html: string, nth: number): string {
  return html.replace(/(<!--herb-region:[^>]*?:[0-9a-f]{8}):\d+-->/, `$1:${nth}-->`)
}

function mount(html: string): HTMLElement {
  const host = document.createElement("div")

  host.innerHTML = html
  document.body.appendChild(host)

  return host
}

describe("SlotIndex", () => {
  let index: SlotIndex

  beforeEach(() => {
    document.body.innerHTML = ""
    index = new SlotIndex()
  })

  describe("regions", () => {
    test("records the file and version a region carries", () => {
      index.scan(mount(CHILD))

      const [region] = index.regionsFor(FILE)

      expect(region.file).toBe(FILE)
      expect(region.version).toBe("25c0946e")
    })

    test("keeps one region per time a template was rendered", () => {
      index.scan(mount(CHILD + occurrence(CHILD, 1) + occurrence(CHILD, 2)))

      expect(index.regionsFor(FILE)).toHaveLength(3)
      expect(index.files()).toEqual([FILE])
    })

    test("keeps the slots of repeated regions apart", () => {
      index.scan(mount(CHILD + occurrence(CHILD, 1)))

      const slots = index.slotsFor(FILE, 0)

      expect(slots).toHaveLength(2)
      expect(slots[0]).not.toBe(slots[1])
    })

    test("takes the occurrence the server numbered it, not the order it sits in", () => {
      index.scan(mount(occurrence(CHILD, 1) + CHILD))

      const [first, second] = index.regionsFor(FILE)

      expect(index.region(FILE, 0)).toBe(second)
      expect(index.region(FILE, 1)).toBe(first)
    })

    test("takes two markers naming the same rendering as one region", () => {
      index.scan(mount(DISPLACED))

      expect(index.regionsFor(FILE)).toHaveLength(1)
      expect(index.region(FILE, 0)?.ranges).toHaveLength(2)
    })

    test("attributes a slot to the rendering its markers name, not the one they sit in", () => {
      index.scan(mount(DISPLACED))

      expect(index.rangeFor(index.slot(FILE, 5)!).toString()).toBe("Title")
      expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("body")
    })

    test("keeps a rendering while any part of it is still on the page", () => {
      const host = mount(DISPLACED)

      index.scan(host)
      host.querySelector("h1")!.previousSibling!.remove()

      index.prune()

      expect(index.regionsFor(FILE)).toHaveLength(1)
      expect(index.slot(FILE, 0)).not.toBeNull()
    })

    test("separates the slots of two renderings by their occurrence", () => {
      index.scan(mount(CHILD + occurrence(CHILD, 1)))

      expect(index.slot(FILE, 0, 0)).not.toBe(index.slot(FILE, 0, 1))
      expect(index.slot(FILE, 0, 2)).toBeNull()
    })
  })

  describe("slot types", () => {
    test("reads an untyped marker as a child slot", () => {
      index.scan(mount(CHILD))

      expect(index.slot(FILE, 0)?.type).toBe("child")
    })

    test("reads the type off a typed marker", () => {
      index.scan(mount(COND_TRUE))

      expect(index.slot(FILE, 0)?.type).toBe("conditional")
    })

    test("reads every anchor an element carries, with its type", () => {
      index.scan(mount(ATTR))

      expect(index.slot(FILE, 0)?.type).toBe("attribute")
      expect(index.slot(FILE, 1)?.type).toBe("element")
    })

    test("reads an element's content anchor as a child slot", () => {
      index.scan(mount(ANCHORED))

      const slot = index.slot(FILE, 0)

      expect(slot?.type).toBe("child")
      expect(slot?.anchor.kind).toBe("content")
    })

    test("reads both roles when one element carries an attribute and its content", () => {
      index.scan(mount(COLLECTION))

      expect(index.slotInRow(FILE, 0, "1", 1)?.anchor.kind).toBe("element")
      expect(index.slotInRow(FILE, 0, "1", 2)?.anchor.kind).toBe("content")
    })
  })

  describe("conditionals", () => {
    test("records which branch rendered", () => {
      index.scan(mount(COND_TRUE))

      expect(index.slot(FILE, 0)?.branch).toBe(0)
    })

    test("leaves the branch unset when a conditional rendered nothing", () => {
      index.scan(mount(COND_FALSE))

      const slot = index.slot(FILE, 0)

      expect(slot?.branch).toBeNull()
      expect(index.rangeFor(slot!).toString()).toBe("")
    })
  })

  describe("collections", () => {
    test("keys each row", () => {
      index.scan(mount(COLLECTION))

      expect([...index.rowsFor(FILE, 0).keys()]).toEqual(["1", "2"])
    })

    test("gives a row a range covering just that row", () => {
      index.scan(mount(COLLECTION))

      const row = index.rowsFor(FILE, 0).get("2")!

      expect(index.rangeForRow(row).toString()).toBe("2")
    })
  })

  describe("tables, where a marker pair is not a pair of siblings", () => {
    test("still pairs row markers the parser split across table and tbody", () => {
      const host = mount(TABLE)

      const rowMarkers = [...host.querySelectorAll("table, tbody")].flatMap((element) =>
        [...element.childNodes].filter((node) => node.nodeType === Node.COMMENT_NODE),
      )

      const parents = new Set(rowMarkers.map((marker) => marker.parentElement?.tagName))
      expect(parents.size).toBeGreaterThan(1)

      index.scan(host)

      expect([...index.rowsFor(FILE, 0).keys()]).toEqual(["1"])
      expect(index.slot(FILE, 0)?.type).toBe("collection")
      expect(index.slotInRow(FILE, 0, "1", 2)?.anchor.kind).toBe("content")
    })
  })

  describe("incremental scanning", () => {
    test("does not index the same markers twice", () => {
      const host = mount(COLLECTION)

      index.scan(host)
      const size = index.size

      index.scan(host)

      expect(index.size).toBe(size)
      expect(index.regionsFor(FILE)).toHaveLength(1)
    })

    test("attaches markup that arrives without a region marker to the region around it", () => {
      const host = mount(`<!--herb-region:${FILE}:aaaaaaaa:0--><div id="host"></div><!--/herb-region:${FILE}-->`)

      index.scan(host)
      expect(index.slot(FILE, 5)).toBeNull()

      const target = host.querySelector("#host")!
      target.innerHTML = `<!--herb-slot:5-->late<!--/herb-slot:5-->`

      const result = index.scan(target)

      expect(result.slots).toHaveLength(1)
      expect(index.slot(FILE, 5)?.type).toBe("child")
      expect(index.rangeFor(index.slot(FILE, 5)!).toString()).toBe("late")
    })

    test("reports what a scan added", () => {
      const result = index.scan(mount(COLLECTION))

      expect(result.regions).toHaveLength(1)
      expect(result.slots.map((slot) => slot.index).sort()).toEqual([0, 1, 1, 2, 2])
    })
  })

  describe("observing", () => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

    test("indexes a partial that arrives after observing started", async () => {
      const host = mount("")

      index.observe(host)
      expect(index.regionsFor(FILE)).toHaveLength(0)

      host.innerHTML = COLLECTION
      await settle()

      expect(index.regionsFor(FILE)).toHaveLength(1)
      expect([...index.rowsFor(FILE, 0).keys()]).toEqual(["1", "2"])

      index.disconnect()
    })

    test("finds markers nested inside an added subtree, which the record does not report", async () => {
      const host = mount("")

      index.observe(host)

      const wrapper = document.createElement("div")
      wrapper.innerHTML = CHILD
      host.appendChild(wrapper)

      await settle()

      expect(index.slot(FILE, 0)?.type).toBe("child")

      index.disconnect()
    })

    test("drops a partial that was removed", async () => {
      const host = mount(CHILD + occurrence(CHILD, 1))

      index.observe(host)
      expect(index.regionsFor(FILE)).toHaveLength(2)

      host.firstElementChild?.remove()
      host.childNodes[0]?.remove()
      await settle()

      expect(index.regionsFor(FILE).length).toBeLessThan(2)

      index.disconnect()
    })

    test("stops indexing once disconnected", async () => {
      const host = mount("")

      index.observe(host)
      index.disconnect()

      host.innerHTML = CHILD
      await settle()

      expect(index.regionsFor(FILE)).toHaveLength(0)
    })
  })

  describe("pruning", () => {
    test("drops regions whose markup left the document", () => {
      const first = mount(CHILD)
      mount(occurrence(CHILD, 1))

      index.scan(document.body)
      expect(index.regionsFor(FILE)).toHaveLength(2)

      first.remove()

      expect(index.prune()).toBe(1)
      expect(index.regionsFor(FILE)).toHaveLength(1)
    })

    test("keeps regions that are still connected", () => {
      index.scan(mount(CHILD))

      expect(index.prune()).toBe(0)
      expect(index.regionsFor(FILE)).toHaveLength(1)
    })
  })

  describe("ranges", () => {
    test("covers what a child slot rendered", () => {
      index.scan(mount(CHILD))

      expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("Marco")
    })

    test("covers an anchored element's content", () => {
      index.scan(mount(ANCHORED))

      expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("Marco")
    })

    test("covers the element itself for an element anchor", () => {
      index.scan(mount(ATTR))

      const range = index.rangeFor(index.slot(FILE, 1)!)

      expect((range.cloneContents().firstElementChild as HTMLElement).tagName).toBe("DIV")
    })
  })
})

const NESTED = `<!--herb-region:${"app/views/posts/index.html.erb"}:8318a878:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0--><span data-herb-child="1">Marco</span><!--/herb-slot:0--></div><!--/herb-region:app/views/posts/index.html.erb-->`
const DEEP = `<!--herb-region:app/views/posts/index.html.erb:df85c53b:0--><!--herb-slot:0:collection--><!--herb-row:0:1--><li id="1" data-herb-slot="1:attribute"><!--herb-slot:2:conditional--><!--herb-branch:2:0--><b data-herb-child="3">1</b><!--/herb-slot:2--></li><!--/herb-row:0--><!--/herb-slot:0--><!--/herb-region:app/views/posts/index.html.erb-->`

function mounted(html: string): SlotIndex {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.appendChild(host)

  const index = new SlotIndex()
  index.scan(host)

  return index
}

describe("dependent slots", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("an element-anchored slot depends on the conditional it renders inside", () => {
    const index = mounted(NESTED)

    expect(index.slot(FILE, 1)?.parent).toBe(index.slot(FILE, 0))
    expect(index.descendantsOf(index.slot(FILE, 0)!).map((slot) => slot.index)).toEqual([1])
  })

  test("nesting is transitive through a collection and a conditional", () => {
    const index = mounted(DEEP)

    const collection = index.slot(FILE, 0)!

    expect(index.descendantsOf(collection).map((slot) => slot.index).sort()).toEqual([1, 2, 3])
    expect(index.ancestorsOf(index.slotInRow(FILE, 0, "1", 3)!).map((slot) => slot.index)).toEqual([2, 0])
  })

  test("a top-level slot depends on nothing", () => {
    const index = mounted(CHILD)

    expect(index.slot(FILE, 0)?.parent).toBeNull()
    expect(index.descendantsOf(index.slot(FILE, 0)!)).toEqual([])
  })
})

describe("collection reconciliation", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("reports nothing to do when the keys match", () => {
    const index = mounted(COLLECTION)

    expect(index.reconcile(index.slot(FILE, 0)!, ["1", "2"]).unchanged).toBe(true)
  })

  test("separates added, removed and moved rows", () => {
    const index = mounted(COLLECTION)
    const plan = index.reconcile(index.slot(FILE, 0)!, ["2", "3"])

    expect(plan.added).toEqual(["3"])
    expect(plan.removed).toEqual(["1"])
    expect(plan.unchanged).toBe(false)
  })

  test("treats a pure reorder as moves, not as rebuilds", () => {
    const index = mounted(COLLECTION)
    const plan = index.reconcile(index.slot(FILE, 0)!, ["2", "1"])

    expect(plan.added).toEqual([])
    expect(plan.removed).toEqual([])
    expect(plan.moved).toEqual(["2", "1"])
  })

  test("reads the order the rows are in now, not the order they were first scanned in", () => {
    const index = mounted(COLLECTION)
    const slot = index.slot(FILE, 0)!
    const [first, second] = [...slot.rows.values()]

    move(second, first)
    index.prune()

    expect(index.reconcile(slot, ["2", "1"]).unchanged).toBe(true)
    expect(index.reconcile(slot, ["1", "2"]).moved).toEqual(["1", "2"])
  })

  test("iterates its rows in the order the page has them", () => {
    const index = mounted(COLLECTION)
    const slot = index.slot(FILE, 0)!
    const [first, second] = [...slot.rows.values()]

    move(second, first)
    index.prune()

    expect([...index.rowsFor(FILE, 0).keys()]).toEqual(["2", "1"])
  })

  test("forgets a row whose markers have left the page", () => {
    const index = mounted(COLLECTION)
    const slot = index.slot(FILE, 0)!

    remove(slot.rows.get("1")!)
    index.prune()

    expect([...slot.rows.keys()]).toEqual(["2"])
    expect(index.slotInRow(FILE, 0, "1", 2)).toBeNull()
  })

  test("stops asking for a row already gone from the page to be removed", () => {
    const index = mounted(COLLECTION)
    const slot = index.slot(FILE, 0)!

    remove(slot.rows.get("1")!)
    index.prune()

    expect(index.reconcile(slot, ["2"]).unchanged).toBe(true)
  })
})

function rowNodes(row: Row): Node[] {
  const range = document.createRange()

  range.setStartBefore(row.start)
  range.setEndAfter(row.end)

  return [...range.extractContents().childNodes]
}

function move(row: Row, before: Row): void {
  const nodes = rowNodes(row)

  for (const node of nodes) before.start.parentNode!.insertBefore(node, before.start)
}

function remove(row: Row): void {
  rowNodes(row)
}

describe("reflecting updates", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("writes a new value into a child slot", () => {
    const index = mounted(CHILD)

    index.update(index.slot(FILE, 0)!, "Alice")

    expect(document.body.textContent).toContain("Hi Alice!")
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("Alice")
  })

  test("writes into an element-anchored content slot", () => {
    const index = mounted(ANCHORED)

    index.update(index.slot(FILE, 0)!, "Alice")

    expect(document.querySelector("span")?.textContent).toBe("Alice")
  })

  test("forgets the slots an update destroyed", () => {
    const index = mounted(NESTED)

    expect(index.slot(FILE, 1)).not.toBeNull()

    index.update(index.slot(FILE, 0)!, "gone")

    expect(index.slot(FILE, 1)).toBeNull()
    expect(document.body.textContent).toContain("gone")
  })

  test("indexes the slots an update brought with it", () => {
    const index = mounted(NESTED)

    const result = index.update(index.slot(FILE, 0)!, `<!--herb-slot:7-->fresh<!--/herb-slot:7-->`)

    expect(result.slots.map((slot) => slot.index)).toEqual([7])
    expect(index.rangeFor(index.slot(FILE, 7)!).toString()).toBe("fresh")
    expect(index.slot(FILE, 7)?.parent).toBe(index.slot(FILE, 0))
  })

  test("replaces one row and leaves its siblings alone", () => {
    const index = mounted(COLLECTION)

    index.updateRow(index.slot(FILE, 0)!, "2", `<li id="2">changed</li>`)

    expect(document.body.textContent).toContain("changed")
    expect(index.rangeForRow(index.rowsFor(FILE, 0).get("1")!).toString()).toBe("1")
  })

  test("parses a replacement row in table context, where a bare <tr> would be dropped", () => {
    const index = mounted(TABLE)

    index.updateRow(index.slot(FILE, 0)!, "1", `<tr id="1"><td>changed</td></tr>`)

    expect(document.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(document.querySelector("tbody tr td")?.textContent).toBe("changed")
  })

  test("writes an attribute for an attribute-anchored slot", () => {
    const index = mounted(ATTR)

    expect(index.setAttribute(index.slot(FILE, 0)!, "active", "class")).toBe(true)
    expect(document.querySelector("[data-herb-slot]")?.getAttribute("class")).toBe("active")
  })

  test("refuses to set an attribute on a slot that is not on an element", () => {
    const index = mounted(CHILD)

    expect(index.setAttribute(index.slot(FILE, 0)!, "x", "class")).toBe(false)
  })
})

describe("markers that arrive as their own node", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("indexes a marker appended as a bare comment", () => {
    const host = mount(`<!--herb-region:${FILE}:aaaaaaaa:0--><div id="host"></div><!--/herb-region:${FILE}-->`)
    const index = new SlotIndex()

    index.scan(host)

    const target = host.querySelector("#host")!
    const open = document.createComment(`herb-slot:9`)
    const close = document.createComment(`/herb-slot:9`)

    target.append(open, document.createTextNode("bare"), close)

    const result = index.scan([open, close])

    expect(result.slots.map((slot) => slot.index)).toEqual([9])
    expect(index.rangeFor(index.slot(FILE, 9)!).toString()).toBe("bare")
  })

  test("a walker rooted at a comment would find nothing, which is why that path exists", () => {
    const comment = document.createComment("herb-slot:0")
    document.body.appendChild(comment)

    const walker = document.createTreeWalker(comment, NodeFilter.SHOW_COMMENT)

    expect(walker.nextNode()).toBeNull()
  })

  test("walks past comments that are not markers", () => {
    const host = mount(
      `<!--herb-region:${FILE}:bbbbbbbb:0--><!-- a note --><!--herb-slot:0-->x<!--/herb-slot:0--><!-- another --><!--/herb-region:${FILE}-->`,
    )
    const index = new SlotIndex()

    index.scan(host)

    expect(index.slot(FILE, 0)?.type).toBe("child")
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("x")
  })
})

describe("a template rendered more than once", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("keeps a slot per row rather than one per template", () => {
    const index = mounted(COLLECTION)

    expect(index.rowsFor(FILE, 0).size).toBe(2)

    const first = index.slotInRow(FILE, 0, "1", 2)!
    const second = index.slotInRow(FILE, 0, "2", 2)!

    expect(first).not.toBe(second)
    expect(index.rangeFor(first).toString()).toBe("1")
    expect(index.rangeFor(second).toString()).toBe("2")
  })

  test("a collection's descendants include every row's slots", () => {
    const index = mounted(COLLECTION)
    const collection = index.slot(FILE, 0)!

    expect(index.descendantsOf(collection).map((slot) => slot.index)).toEqual([1, 2, 1, 2])
  })
})

describe("updating one row of a collection", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("writes into one row's slot and leaves its sibling untouched", () => {
    const index = mounted(COLLECTION)

    index.update(index.slotInRow(FILE, 0, "1", 2)!, "changed")

    expect(index.rangeFor(index.slotInRow(FILE, 0, "1", 2)!).toString()).toBe("changed")
    expect(index.rangeFor(index.slotInRow(FILE, 0, "2", 2)!).toString()).toBe("2")
  })

  test("each row's attribute slot points at that row's element", () => {
    const index = mounted(COLLECTION)

    const first = index.slotInRow(FILE, 0, "1", 1)!
    const second = index.slotInRow(FILE, 0, "2", 1)!

    index.setAttribute(first, "active", "class")

    expect((first.anchor as { element: Element }).element.getAttribute("id")).toBe("1")
    expect((second.anchor as { element: Element }).element.getAttribute("id")).toBe("2")
    expect(document.querySelectorAll(".active")).toHaveLength(1)
  })
})

describe("HerbRuntime", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    HerbRuntime.get()?.stop()
  })

  test("hands back the same runtime rather than a second index", () => {
    const runtime = HerbRuntime.start()

    expect(HerbRuntime.start()).toBe(runtime)
    expect(HerbRuntime.get()).toBe(runtime)

    runtime.stop()
  })

  test("refuses to be constructed directly, since a second index would see only its own updates", () => {
    expect(() => new (HerbRuntime as unknown as new () => unknown)()).toThrow(TypeError)
  })

  test("is not running until asked", () => {
    expect(HerbRuntime.get()).toBeNull()
  })
})
