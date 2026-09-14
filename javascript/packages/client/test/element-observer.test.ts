import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { ElementObserver } from "../src/shared/element-observer"
import { Runtime } from "../src/runtime"

const NATIVE = window.MutationObserver

let built: number

function countObservers(): void {
  built = 0

  window.MutationObserver = class extends NATIVE {
    constructor(callback: MutationCallback) {
      super(callback)

      built += 1
    }
  } as unknown as typeof MutationObserver
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  document.body.innerHTML = ""

  countObservers()
})

afterEach(() => {
  window.MutationObserver = NATIVE
  Runtime.get()?.stop()
})

describe("the watch a started runtime keeps over the page", () => {
  test("is one observer, however many parts of the runtime care about it", () => {
    Runtime.start({ state: {} })

    expect(built).toBe(1)
  })

  test("is given up once the runtime stops", async () => {
    const runtime = Runtime.start({ state: {} })

    runtime.stop()

    let announced = 0

    const observer = new ElementObserver()

    observer.add({ nodesAdded: () => (announced += 1) })
    document.body.appendChild(document.createElement("div"))

    await settle()

    expect(announced).toBe(0)
  })
})

describe("what an observer tells the parts that asked", () => {
  let observer: ElementObserver

  beforeEach(() => {
    observer = new ElementObserver(["data-herb-on"])
    observer.observe(document.body)
  })

  afterEach(() => observer.disconnect())

  test("tells everyone that asked about a node, not just the first", async () => {
    const heard: string[] = []

    observer.add({ nodesAdded: () => heard.push("first") })
    observer.add({ nodesAdded: () => heard.push("second") })

    document.body.appendChild(document.createElement("div"))

    await settle()

    expect(heard).toEqual(["first", "second"])
  })

  test("says nothing about an attribute to a part that never asked", async () => {
    const element = document.createElement("div")

    document.body.appendChild(element)

    await settle()

    const heard: string[] = []

    observer.add({ nodesAdded: () => heard.push("added") })
    observer.add({ attributeChanged: (_element, name) => heard.push(`attribute:${name}`) })

    element.setAttribute("data-herb-on", "click")

    await settle()

    expect(heard).toEqual(["attribute:data-herb-on"])
  })

  test("leaves an attribute nobody named alone", async () => {
    const element = document.createElement("div")

    document.body.appendChild(element)

    await settle()

    const heard: string[] = []

    observer.add({ attributeChanged: (_element, name) => heard.push(name) })

    element.setAttribute("class", "loud")

    await settle()

    expect(heard).toEqual([])
  })

  test("stops telling a part that took itself off", async () => {
    const heard: string[] = []
    const remove = observer.add({ nodesAdded: () => heard.push("added") })

    remove()
    document.body.appendChild(document.createElement("div"))

    await settle()

    expect(heard).toEqual([])
  })

  test("says nothing about markup that was replaced before the batch arrived", async () => {
    const seen: string[] = []

    observer.add({ nodesAdded: (nodes) => nodes.forEach((node) => seen.push((node as Element).id ?? "?")) })

    const first = document.createElement("div")
    first.id = "gone"
    document.body.appendChild(first)

    const second = document.createElement("div")
    second.id = "stayed"
    first.replaceWith(second)

    await settle()

    expect(seen).toEqual(["stayed"])
  })

  test("still says what left, so a part can forget it", async () => {
    const seen: string[] = []

    const element = document.createElement("div")
    document.body.appendChild(element)

    await settle()

    observer.add({ nodesRemoved: (nodes) => nodes.forEach(() => seen.push("removed")) })

    element.remove()

    await settle()

    expect(seen).toEqual(["removed"])
  })

  test("says what left even when it came back, since leaving is only a prompt to look", async () => {
    const seen: string[] = []

    const element = document.createElement("div")
    element.id = "flickered"
    document.body.appendChild(element)

    await settle()

    observer.add({ nodesRemoved: (nodes) => nodes.forEach((node) => seen.push((node as Element).id)) })

    const anchor = document.createElement("span")
    document.body.appendChild(anchor)
    element.remove()
    document.body.appendChild(element)

    await settle()

    expect(seen).toEqual(["flickered"])
    expect(element.isConnected).toBe(true)
  })
})
