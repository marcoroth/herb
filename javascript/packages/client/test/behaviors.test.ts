import { describe, test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"
import { resetReport } from "../src/shared/report"

import type { Behavior } from "../src/shared/behaviors"
import type { Payload } from "../src/types"

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let runtime: Runtime | null = null

function start(): Runtime {
  runtime = Runtime.start()

  return runtime
}

function recording(): Behavior & { log: string[] } {
  const log: string[] = []

  return {
    log,
    connect: (element) => log.push(`connect ${element.id}`),
    disconnect: (element) => log.push(`disconnect ${element.id}`),
    valueChanged: (element, value) => log.push(`change ${element.id} ${value}`),
  }
}

afterEach(() => {
  runtime?.stop()
  runtime = null
  resetReport()
  document.body.innerHTML = ""
})

describe("behaviors", () => {
  test("connects the elements already on the page when defined", () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div><div id="b" data-drawer="top"></div>`

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)

    expect(behavior.log).toEqual(["connect a", "connect b"])
  })

  test("connects elements that arrive later, wherever they sit in the subtree", async () => {
    document.body.innerHTML = ""

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)

    document.body.innerHTML = `<section><div id="late" data-drawer="bottom"></div></section>`
    await settle()

    expect(behavior.log).toEqual(["connect late"])
  })

  test("disconnects an element that leaves the document", async () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div>`

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)

    document.querySelector("#a")!.remove()
    await settle()

    expect(behavior.log).toEqual(["connect a", "disconnect a"])
  })

  test("survives a Turbo body replacement", async () => {
    document.body.innerHTML = `<div id="first" data-drawer="bottom"></div>`

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)

    const next = document.createElement("body")

    next.innerHTML = `<div id="second" data-drawer="bottom"></div>`
    document.body.replaceWith(next)
    await settle()

    expect(behavior.log).toEqual(["connect first", "connect second", "disconnect first"])
  })

  test("reports a changed value, and treats the attribute coming and going as connect and disconnect", async () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div><div id="bare"></div>`

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)

    const element = document.querySelector("#a")!
    const bare = document.querySelector("#bare")!

    element.setAttribute("data-drawer", "left")
    await settle()

    element.removeAttribute("data-drawer")
    await settle()

    bare.setAttribute("data-drawer", "right")
    await settle()

    expect(behavior.log).toEqual(["connect a", "change a left", "disconnect a", "connect bare"])
  })

  test("every callback receives the element's scoped state, slots and outbox", () => {
    const FILE = "app/views/page/drawer.html.erb"

    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<aside id="drawer" data-soil-drawer><!--herb-slot:0:conditional--><!--herb-branch:0:1-->closed<!--/herb-slot:0--></aside>` +
      `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:0-->opened<!--herb-branch:0:1-->closed</template>` +
      `<!--/herb-region:${FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({
        state: {},
        states: {
          [FILE]: {
            version: "aaaaaaaa",
            declarations: [{ name: "open", kind: "boolean", default: "false", scope: "region" }],
            reads: {},
            conditionals: { 0: { arms: [["open", null, 0]], else: 1 } },
          },
        },
      })}</template>`

    const live = start()
    const seen: string[] = []

    live.behaviors.define("data-soil-drawer", {
      connect: (element, { state, slots, outbox }) => {
        seen.push(`connect ${element.id} open=${String(state.get("open"))} slots=${slots === live.slots} outbox=${outbox === live.outbox}`)
        state.set({ open: true })
      },
    })

    expect(seen).toEqual(["connect drawer open=false slots=true outbox=true"])
    expect(live.state.getState("open")).toBe(true)
    expect(document.querySelector("#drawer")?.textContent).toBe("opened")
  })

  test("leave holds the branch around the element until its promise settles, then disconnect follows", async () => {
    const FILE = "app/views/page/drawer.html.erb"

    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<div id="host"><!--herb-slot:0:conditional--><!--herb-branch:0:0--><aside id="drawer" data-soil-drawer>opened</aside><!--/herb-slot:0--></div>` +
      `<p id="outside" data-soil-drawer></p>` +
      `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:0--><aside id="drawer" data-soil-drawer>opened</aside><!--herb-branch:0:1-->closed</template>` +
      `<!--/herb-region:${FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({
        state: {},
        states: {
          [FILE]: {
            version: "aaaaaaaa",
            declarations: [{ name: "open", kind: "boolean", default: "true", value: true, scope: "region" }],
            reads: {},
            conditionals: { 0: { arms: [["open", null, 0]], else: 1 } },
          },
        },
      })}</template>`

    const live = start()
    const behavior = recording()

    let release: () => void = () => {}

    behavior.leave = (element) => {
      behavior.log.push(`leave ${element.id} connected=${element.isConnected}`)

      return new Promise<void>((resolve) => {
        release = resolve
      })
    }

    live.behaviors.define("data-soil-drawer", behavior)
    live.state.setState({ open: false })

    expect(document.querySelector("#host")?.textContent).toBe("opened")
    expect(behavior.log).toEqual(["connect drawer", "connect outside", "leave drawer connected=true"])

    release()
    await settle()

    expect(document.querySelector("#host")?.textContent).toBe("closed")
    expect(behavior.log).toEqual(["connect drawer", "connect outside", "leave drawer connected=true", "disconnect drawer"])
  })

  const LIST = "app/views/posts/index.html.erb"

  function list(): string {
    return (
      `<!--herb-region:${LIST}:aaaaaaaa:0-->` +
      `<ul><!--herb-slot:0:collection-->` +
      `<!--herb-item:0:a--><li id="a" data-soil-row data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">first</span></li><!--/herb-item:0-->` +
      `<!--herb-item:0:b--><li id="b" data-soil-row data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">second</span></li><!--/herb-item:0-->` +
      `<!--/herb-slot:0--></ul>` +
      `<!--/herb-region:${LIST}-->` +
      `<template data-herb-manifests>${JSON.stringify({ [`${LIST}:aaaaaaaa`]: { file: LIST, identifier: LIST, version: "aaaaaaaa", names: {}, parts: {}, states: null } })}</template>`
    )
  }

  function rows(): Payload {
    return { template: LIST, version: "aaaaaaaa", occurrence: 0, slots: {} }
  }

  test("enter fires after connect for markup the runtime built, not for markup that was already there", async () => {
    document.body.innerHTML = list()

    const live = start()
    const behavior = recording()

    behavior.enter = (element) => {
      behavior.log.push(`enter ${element.id}`)
    }

    live.behaviors.define("data-soil-row", behavior)
    live.slots.apply({ ...rows(), slots: { 0: { items: { a: {}, b: {}, c: { 1: "c", 2: "third" } }, order: ["a", "b", "c"] } } })
    await settle()

    expect(behavior.log).toEqual(["connect a", "connect b", "connect c", "enter c"])
  })

  test("leave holds a row the payload removed, and the row stays in place until it settles", async () => {
    document.body.innerHTML = list()

    const live = start()
    const behavior = recording()

    let release: () => void = () => {}

    behavior.leave = (element) => {
      behavior.log.push(`leave ${element.id}`)

      return new Promise<void>((resolve) => {
        release = resolve
      })
    }

    live.behaviors.define("data-soil-row", behavior)
    live.slots.apply({ ...rows(), slots: { 0: { items: { b: {} }, order: ["b"] } } })

    expect([...document.querySelectorAll("li")].map((li) => li.id)).toEqual(["a", "b"])
    expect(behavior.log).toEqual(["connect a", "connect b", "leave a"])

    release()
    await settle()

    expect([...document.querySelectorAll("li")].map((li) => li.id)).toEqual(["b"])
    expect(behavior.log).toEqual(["connect a", "connect b", "leave a", "disconnect a"])
  })

  test("a row the next payload wants again is not removed when its hold settles", async () => {
    document.body.innerHTML = list()

    const live = start()

    let release: () => void = () => {}

    live.behaviors.define("data-soil-row", {
      leave: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })

    live.slots.apply({ ...rows(), slots: { 0: { items: { b: {} }, order: ["b"] } } })
    live.slots.apply({ ...rows(), slots: { 0: { items: { a: {}, b: {} }, order: ["a", "b"] } } })

    release()
    await settle()

    expect([...document.querySelectorAll("li")].map((li) => li.id)).toEqual(["a", "b"])
  })

  test("moved reports the rect a row came from when the collection is reordered", () => {
    document.body.innerHTML = list()

    const live = start()
    const moves: string[] = []

    live.behaviors.define("data-soil-row", {
      moved: (element, { from, to }) => {
        moves.push(`${element.id} ${from.top < to.top ? "down" : "up"}`)
      },
    })

    live.slots.apply({ ...rows(), slots: { 0: { items: { b: {}, a: {} }, order: ["b", "a"] } } })

    expect([...document.querySelectorAll("li")].map((li) => li.id)).toEqual(["b", "a"])
    expect(moves.sort()).toEqual(["a down", "b up"])
  })

  test("updated names the slot written inside the element, and settled follows once per batch", () => {
    document.body.innerHTML = list()

    const live = start()
    const seen: string[] = []

    live.behaviors.define("data-soil-row", {
      updated: (element, slot) => {
        seen.push(`updated ${element.id} ${slot.index}`)
      },
      settled: (element) => {
        seen.push(`settled ${element.id}`)
      },
    })

    live.slots.apply({ ...rows(), slots: { 0: { items: { a: { 2: "changed", 1: "a" }, b: {} }, order: ["a", "b"] } } })

    expect(seen).toEqual(["updated a 2", "settled a"])
  })

  test("transition names the element for view transitions, and the name follows the value", async () => {
    document.body.innerHTML = `<aside id="drawer" data-soil-drawer="bottom"></aside>`

    start().behaviors.define("data-soil-drawer", {
      transition: (element) => (element.getAttribute("data-soil-drawer") === "none" ? undefined : `drawer-${element.getAttribute("data-soil-drawer")}`),
    })

    const drawer = document.querySelector("#drawer")!

    expect(drawer.getAttribute("data-herb-transition")).toBe("drawer-bottom")

    drawer.setAttribute("data-soil-drawer", "left")
    await settle()

    expect(drawer.getAttribute("data-herb-transition")).toBe("drawer-left")

    drawer.setAttribute("data-soil-drawer", "none")
    await settle()

    expect(drawer.hasAttribute("data-herb-transition")).toBe(false)
  })

  test("a bare attribute connects, and gaining a value reports it", async () => {
    document.body.innerHTML = `<div id="bare" data-soil-drawer></div>`

    const behavior = recording()

    start().behaviors.define("data-soil-drawer", behavior)

    document.querySelector("#bare")!.setAttribute("data-soil-drawer", "left")
    await settle()

    expect(behavior.log).toEqual(["connect bare", "change bare left"])
  })

  test("undefining disconnects everything it connected", () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div>`

    const behavior = recording()
    const undefine = start().behaviors.define("data-drawer", behavior)

    undefine()

    expect(behavior.log).toEqual(["connect a", "disconnect a"])
  })

  test("stopping the runtime disconnects everything", () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div>`

    const behavior = recording()

    start().behaviors.define("data-drawer", behavior)
    runtime!.stop()

    expect(behavior.log).toEqual(["connect a", "disconnect a"])
  })

  test("two behaviors on one attribute both connect", () => {
    document.body.innerHTML = `<div id="a" data-drawer="bottom"></div>`

    const first = recording()
    const second = recording()
    const live = start()

    live.behaviors.define("data-drawer", first)
    live.behaviors.define("data-drawer", second)

    expect(first.log).toEqual(["connect a"])
    expect(second.log).toEqual(["connect a"])
  })

  test("a throwing behavior is reported and does not stop the others", () => {
    document.body.innerHTML = `<meta name="herb-debug-mode" content="true"><div id="a" data-drawer="bottom"></div>`

    const warn = vi.spyOn(console, "error").mockImplementation(() => {})
    const behavior = recording()
    const live = start()

    live.behaviors.define("data-drawer", {
      connect: () => {
        throw new Error("boom")
      },
    })
    live.behaviors.define("data-drawer", behavior)

    expect(behavior.log).toEqual(["connect a"])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"), expect.objectContaining({ code: "herb-behavior-error" }))

    warn.mockRestore()
  })
})
