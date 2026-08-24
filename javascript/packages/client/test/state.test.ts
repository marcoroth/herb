import { describe, test, expect, beforeEach, vi } from "vitest"

import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

import type { Payload } from "../src/types"
import type { StateRequest } from "../src/state"

const FILE = "app/views/posts/index.html.erb"
const VERSION = "aaaaaaaa"

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<p>Hi <!--herb-slot:0-->Marco<!--/herb-slot:0-->!</p>` +
  `<input data-herb-slot="1:attribute:value" value="Marco">` +
  `<p><!--herb-slot:2-->5<!--/herb-slot:2--></p>` +
  `<!--/herb-region:${FILE}-->`

const MAP = {
  state: {
    "@name": [
      { file: FILE, version: VERSION, index: 0 },
      { file: FILE, version: VERSION, index: 1 },
    ],
  },
  params: { name: "@name" },
}

const DEPENDENCIES = `<template data-herb-dependencies>${JSON.stringify(MAP)}</template>`

function payload(slots: Payload["slots"]): Payload {
  return { template: FILE, version: VERSION, occurrence: 0, slots }
}

function mounted(html: string) {
  document.body.innerHTML = html

  const slots = new SlotIndex()

  slots.scan(document.body)

  return slots
}

function text(index: number, slots: SlotIndex): string {
  return slots.rangeOf(slots.slot(FILE, index)!).toString()
}

function input(): HTMLInputElement {
  return document.querySelector("input")!
}

describe("adopting the dependency map", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("reads what the page parked and takes it out of the document", () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    expect(state.adopt()).toBe(1)
    expect(state.names()).toEqual(["@name"])
    expect(document.querySelector("template[data-herb-dependencies]")).toBeNull()
  })

  test("survives markup that is not a map", () => {
    const slots = mounted(PAGE + `<template data-herb-dependencies>not json</template>`)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    expect(state.names()).toEqual([])
  })
})

describe("writing before the server answers", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("writes every identity slot the state reaches", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    const report = await state.set("name", "Ada")

    expect(report.written).toBe(2)
    expect(text(0, slots)).toBe("Ada")
    expect(input().getAttribute("value")).toBe("Ada")
  })

  test("leaves a slot it cannot compute to the server", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    await state.set("name", "Ada")

    expect(text(2, slots)).toBe("5")
  })

  test("escapes what it writes, the way the template would have", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    await state.set("name", "<b>Ada</b>")

    expect(document.querySelector("p b")).toBeNull()
    expect(document.querySelector("p")!.innerHTML).toContain("&lt;b&gt;Ada&lt;/b&gt;")
  })

  test("writes a value as text, so markup in it never becomes markup", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    await state.set("name", "<img src=x onerror=alert(1)>")

    const paragraph = document.querySelector("p")!
    const written = [...paragraph.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.startsWith("<img"))

    expect(document.querySelector("img")).toBeNull()
    expect(written).toHaveLength(1)
  })

  test("finds the state a request name feeds", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    expect(state.slotsFor("name")).toHaveLength(2)
    expect((await state.set("name", "Ada")).written).toBe(2)
  })

  test("takes the name the template uses as well" , async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    expect(state.slotsFor("@name")).toHaveLength(2)
    expect((await state.set("@name", "Ada")).written).toBe(2)
  })

  test("writes nothing for a request name the server said nothing about", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    expect(state.slotsFor("nickname")).toEqual([])
    expect((await state.set("nickname", "Ada")).written).toBe(0)
  })

  test("writes nothing for a state no slot reads", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()

    const report = await state.set("unknown", "x")

    expect(report.written).toBe(0)
  })
})

describe("a page that waits for the server", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("writes what it can before the debounce, not after it", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { debounce: 50, transport: async () => null })

    state.adopt()

    const pending = state.set("name", "Ada")

    expect(text(0, slots)).toBe("Ada")

    await pending
  })

  test("counts every write it made across a debounced burst" , async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { debounce: 50, transport: async () => null })

    state.adopt()

    state.set("name", "A")
    const report = await state.set("name", "Ada")

    expect(text(0, slots)).toBe("Ada")
    expect(report.written).toBeGreaterThan(0)
  })

  test("puts back the value the page had before the burst, not the one mid-burst", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, {
      debounce: 20,
      transport: async () => {
        throw new Error("offline")
      },
    })

    state.adopt()

    state.set("name", "A")
    const report = await state.set("name", "Ada")

    expect(report.failed).toBe(true)
    expect(text(0, slots)).toBe("Marco")
    expect(state.get("name")).toBeUndefined()
  })
})

describe("two flushes racing", () => {
  const RACE_PAGE =
    `<!--herb-region:${FILE}:${VERSION}:0-->` +
    `<p><!--herb-slot:0-->old-a<!--/herb-slot:0--></p>` +
    `<p><!--herb-slot:1-->old-b<!--/herb-slot:1--></p>` +
    `<!--/herb-region:${FILE}-->`

  const RACE_MAP = {
    state: {
      "@a": [{ file: FILE, version: VERSION, index: 0 }],
      "@b": [{ file: FILE, version: VERSION, index: 1 }],
    },
    params: { a: "@a", b: "@b" },
  }

  test("an aborted flush leaves the newer flush's world alone", async () => {
    const slots = mounted(RACE_PAGE + `<template data-herb-dependencies>${JSON.stringify(RACE_MAP)}</template>`)

    let calls = 0
    const transport = async (_request: StateRequest, signal: AbortSignal): Promise<Payload | null> => {
      calls += 1

      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        })
      }

      return null
    }

    const state = new SlotState(slots, { debounce: 0, transport })

    state.adopt()

    const first = state.set("a", "new-a")

    await new Promise((resolve) => setTimeout(resolve, 10))

    const second = state.set("b", "new-b")

    await Promise.all([first, second])

    expect(text(0, slots)).toBe("new-a")
    expect(state.get("a")).toBe("new-a")
  })
})

describe("reconciling with the server", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("a payload that confirms the write applies nothing", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => payload({ 0: "Ada", 1: "Ada" }) })

    state.adopt()

    const report = await state.set("name", "Ada")

    expect(report.written).toBe(2)
    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([])
  })

  test("a payload that corrects the write overwrites it", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => payload({ 0: "Ada Lovelace", 2: "6" }) })

    state.adopt()

    const report = await state.set("name", "Ada")

    expect(report.applied).toBe(2)
    expect(text(0, slots)).toBe("Ada Lovelace")
    expect(text(2, slots)).toBe("6")
  })

  test("a request that fails puts back what the page had", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, {
      transport: async () => {
        throw new Error("offline")
      },
    })

    state.adopt()

    const report = await state.set("name", "Ada")

    expect(report.failed).toBe(true)
    expect(report.restored).toBe(2)
    expect(text(0, slots)).toBe("Marco")
    expect(input().getAttribute("value")).toBe("Marco")
    expect(state.get("name")).toBeUndefined()
  })

  test("a reply that lost the race does not overwrite a newer write", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    let release: (() => void) | null = null

    const transport = vi
      .fn()
      .mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
          release = resolve
        })

        return payload({ 0: "stale" })
      })
      .mockImplementationOnce(async () => payload({ 0: "Grace" }))

    const state = new SlotState(slots, { transport })

    state.adopt()

    const first = state.set("name", "Ada")
    const second = await state.set("name", "Grace")

    release!()

    expect((await first).stale).toBe(true)
    expect(second.written).toBe(2)
    expect(text(0, slots)).toBe("Grace")
  })
})

describe("keeping commands out of the address bar", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("keeps a param that appeared after adoption", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { persist: "known", transport: async () => null })

    state.adopt()

    window.history.replaceState({}, "", "/posts?modal=1")

    await state.set("name", "Ada")

    const params = new URLSearchParams(window.location.search)

    expect(params.get("modal")).toBe("1")
    expect(params.get("name")).toBe("Ada")
  })

  test("persists a key the map names", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { persist: "known", transport: async () => null })

    state.adopt()

    await state.set("name", "Ada")

    expect(window.location.search).toBe("?name=Ada")
  })

  test("leaves out a key the map says nothing about", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { persist: "known", transport: async () => null })

    state.adopt()

    await state.set({ name: "Ada", remove: "3" })

    expect(window.location.search).toBe("?name=Ada")
    expect(state.get("name")).toBe("Ada")
  })

  test("forgets a command that arrived in the address bar, once it has been sent", async () => {
    window.history.replaceState({}, "", "/posts?name=Marco&reset=1")

    const slots = mounted(PAGE + DEPENDENCIES)
    const seen: StateRequest[] = []
    const state = new SlotState(slots, {
      persist: "known",
      transport: async (request) => {
        seen.push(request)

        return null
      },
    })

    state.adopt()

    await state.set("name", "Ada")
    await state.set("name", "Grace")

    expect(seen[0].state).toEqual({ name: "Ada", reset: "1" })
    expect(seen[1].state).toEqual({ name: "Grace" })
    expect(state.get("reset")).toBeUndefined()
    expect(window.location.search).toBe("?name=Grace")
  })

  test("forgets a command once it has been sent, so the next ask does not repeat it", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const seen: StateRequest[] = []
    const state = new SlotState(slots, {
      persist: "known",
      transport: async (request) => {
        seen.push(request)

        return null
      },
    })

    state.adopt()

    await state.set({ add: "1" })
    await state.set("name", "Ada")

    expect(seen[0].state).toEqual({ add: "1" })
    expect(seen[1].state).toEqual({ name: "Ada" })
    expect(state.get("add")).toBeUndefined()
  })

  test("still sends what it leaves out", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const seen: StateRequest[] = []
    const state = new SlotState(slots, {
      persist: "known",
      transport: async (request) => {
        seen.push(request)

        return null
      },
    })

    state.adopt()

    await state.set({ add: "1" })

    expect(seen[0].state).toEqual({ add: "1" })
    expect(window.location.search).toBe("")
  })

  test("writes nothing to the address bar when the page has no map", async () => {
    const slots = mounted(PAGE)
    const state = new SlotState(slots, { persist: "known", transport: async () => null })

    await state.set("name", "Ada")

    expect(window.location.search).toBe("")
  })
})

describe("state that has no business in a URL", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("does not read the query string when it is not kept there", () => {
    window.history.replaceState({}, "", "/posts?name=Marco")

    const state = new SlotState(mounted(PAGE), { transport: async () => null, persist: "none" })

    expect(state.get("name")).toBeUndefined()
    expect(state.all()).toEqual({})
  })

  test("leaves the address bar alone", async () => {
    const state = new SlotState(mounted(PAGE), { transport: async () => null, persist: "none" })

    await state.set("name", "Ada")

    expect(window.location.search).toBe("")
    expect(state.get("name")).toBe("Ada")
  })

  test("still sends what it was given", async () => {
    const seen: StateRequest[] = []
    const state = new SlotState(mounted(PAGE), {
      persist: "none",
      transport: async (request) => {
        seen.push(request)

        return null
      },
    })

    await state.set({ id: "3", city: "Basel" })

    expect(seen[0].state).toEqual({ id: "3", city: "Basel" })
    expect(seen[0].changed).toEqual(["id", "city"])
  })

  test("still writes the slots it can", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null, persist: "none" })

    state.adopt()

    const report = await state.set("name", "Ada")

    expect(report.written).toBe(2)
    expect(text(0, slots)).toBe("Ada")
  })
})

describe("the query string as the state", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("reads what the page was asked for", () => {
    window.history.replaceState({}, "", "/posts?name=Marco&page=2")

    const state = new SlotState(mounted(PAGE), { transport: async () => null })

    expect(state.get("name")).toBe("Marco")
    expect(state.get("page")).toBe("2")
  })

  test("leaves the format out of the state it carries", () => {
    window.history.replaceState({}, "", "/posts?name=Marco&format=slots")

    const state = new SlotState(mounted(PAGE), { transport: async () => null })

    expect(state.all()).toEqual({ name: "Marco" })
  })

  test("puts the state it was given back in the address bar", async () => {
    const state = new SlotState(mounted(PAGE), { transport: async () => null })

    await state.set("name", "Ada")

    expect(window.location.search).toBe("?name=Ada")
  })

  test("sends the whole state, and says which of it changed", async () => {
    window.history.replaceState({}, "", "/posts?name=Marco&page=2")

    const seen: StateRequest[] = []
    const state = new SlotState(mounted(PAGE), {
      transport: async (request) => {
        seen.push(request)

        return null
      },
    })

    await state.set("name", "Ada")

    expect(seen[0].state).toEqual({ name: "Ada", page: "2" })
    expect(seen[0].changed).toEqual(["name"])
  })

  test("sends one request for everything set together", async () => {
    const transport = vi.fn().mockResolvedValue(null)
    const state = new SlotState(mounted(PAGE), { transport })

    await state.set({ name: "Ada", page: "3" })

    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][0].changed).toEqual(["name", "page"])
  })
})

describe("an attribute the DOM property does not follow", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/posts")
  })

  test("moves a written value onto the element that holds it", async () => {
    const slots = mounted(PAGE + DEPENDENCIES)
    const state = new SlotState(slots, { transport: async () => null })

    state.adopt()
    state.observe()

    input().value = "typed"

    await state.set("name", "Ada")

    expect(input().value).toBe("Ada")

    state.disconnect()
  })
})
