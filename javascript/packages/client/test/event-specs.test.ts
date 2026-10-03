import { describe, test, expect } from "vitest"

import { parseEventSpec, eventMatches, eventSpecProblem } from "../src/actions/events"

const keydown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init)

describe("reading an event spec", () => {
  test("reads a bare event name", () => {
    expect(parseEventSpec("click")).toEqual({ type: "click", key: null, modifiers: [], global: false, outside: false })
  })

  test("reads a key filter with a chord of modifiers", () => {
    expect(parseEventSpec("keydown.ctrl+shift+f@window")).toEqual({
      type: "keydown",
      key: "f",
      modifiers: ["ctrl", "shift"],
      global: true,
      outside: false,
    })
  })

  test("accepts a filter on every keyboard event", () => {
    expect(parseEventSpec("keyup.enter").key).toBe("enter")
    expect(parseEventSpec("keypress.a").key).toBe("a")
  })

  test("maps the key names Stimulus maps", () => {
    expect(parseEventSpec("keydown.esc").key).toBe("escape")
    expect(parseEventSpec("keydown.space").key).toBe(" ")
    expect(parseEventSpec("keydown.up").key).toBe("arrowup")
    expect(parseEventSpec("keydown.down").key).toBe("arrowdown")
    expect(parseEventSpec("keydown.left").key).toBe("arrowleft")
    expect(parseEventSpec("keydown.right").key).toBe("arrowright")
    expect(parseEventSpec("keydown.page_up").key).toBe("pageup")
    expect(parseEventSpec("keydown.page_down").key).toBe("pagedown")
  })

  test("treats cmd as the meta key", () => {
    expect(parseEventSpec("keydown.cmd+k").modifiers).toEqual(["meta"])
  })

  test("keeps a dotted name on other events as one event name", () => {
    expect(parseEventSpec("library.change")).toEqual({ type: "library.change", key: null, modifiers: [], global: false, outside: false })
  })

  test("reads a modifier prefixed to a mouse event", () => {
    expect(parseEventSpec("meta+click")).toEqual({ type: "click", key: null, modifiers: ["meta"], global: false, outside: false })
  })

  test("marks a document target as global", () => {
    expect(parseEventSpec("keydown.esc@document").global).toBe(true)
  })

  test("marks an outside target as a global listener that excludes the element", () => {
    expect(parseEventSpec("click@outside")).toEqual({ type: "click", key: null, modifiers: [], global: true, outside: true })
  })
})

describe("matching a key filter", () => {
  const spec = (event: string) => parseEventSpec(event)

  test("matches a capital letter against a lowercase filter", () => {
    expect(eventMatches(spec("keydown.j"), keydown({ key: "J" }))).toBe(true)
  })

  test("requires every named modifier and no others", () => {
    expect(eventMatches(spec("keydown.ctrl+k"), keydown({ key: "k", ctrlKey: true }))).toBe(true)
    expect(eventMatches(spec("keydown.ctrl+k"), keydown({ key: "k" }))).toBe(false)
    expect(eventMatches(spec("keydown.ctrl+k"), keydown({ key: "k", ctrlKey: true, altKey: true }))).toBe(false)
    expect(eventMatches(spec("keydown.k"), keydown({ key: "k", metaKey: true }))).toBe(false)
  })

  test("leaves an unfiltered event alone whatever is held", () => {
    expect(eventMatches(spec("keydown"), keydown({ key: "k", metaKey: true, shiftKey: true }))).toBe(true)
  })

  test("falls back to the physical key when the layout types another alphabet", () => {
    expect(eventMatches(spec("keydown.j"), keydown({ key: "й", code: "KeyJ" }))).toBe(true)
    expect(eventMatches(spec("keydown.j"), keydown({ key: "ξ", code: "KeyJ" }))).toBe(true)
    expect(eventMatches(spec("keydown.j"), keydown({ key: "ח", code: "KeyJ" }))).toBe(true)
    expect(eventMatches(spec("keydown.j"), keydown({ key: "й", code: "KeyQ" }))).toBe(false)
  })

  test("falls back for a digit the layout hides behind another character", () => {
    expect(eventMatches(spec("keydown.2"), keydown({ key: "é", code: "Digit2" }))).toBe(true)
    expect(eventMatches(spec("keydown.2"), keydown({ key: "é", code: "Digit3" }))).toBe(false)
  })

  test("never falls back while composing", () => {
    expect(eventMatches(spec("keydown.j"), keydown({ key: "й", code: "KeyJ", isComposing: true }))).toBe(false)
  })

  test("never falls back when the typed key is printable ascii", () => {
    expect(eventMatches(spec("keydown.a"), keydown({ key: "q", code: "KeyA" }))).toBe(false)
  })

  test("never falls back for a filter outside ascii", () => {
    expect(eventMatches(spec("keydown.й"), keydown({ key: "й" }))).toBe(true)
    expect(eventMatches(spec("keydown.й"), keydown({ key: "j", code: "KeyJ" }))).toBe(false)
  })

  test("never falls back from a key with no letter or digit position", () => {
    expect(eventMatches(spec("keydown.1"), keydown({ key: "ω", code: "Semicolon" }))).toBe(false)
    expect(eventMatches(spec("keydown.f"), keydown({ key: "ф", code: "F1" }))).toBe(false)
    expect(eventMatches(spec("keydown.5"), keydown({ key: "ت", code: "Numpad5" }))).toBe(false)
  })

  test("matches the space alias against the space bar", () => {
    expect(eventMatches(spec("keydown.space"), keydown({ key: " " }))).toBe(true)
  })

  test("matches an arrow alias against the arrow key", () => {
    expect(eventMatches(spec("keydown.left"), keydown({ key: "ArrowLeft" }))).toBe(true)
    expect(eventMatches(spec("keydown.left"), keydown({ key: "Left" }))).toBe(false)
  })

  test("ignores an event of another type entirely", () => {
    expect(eventMatches(spec("keydown.j"), new KeyboardEvent("keyup", { key: "j" }))).toBe(false)
  })
})

describe("naming what is wrong with an event spec", () => {
  test("accepts every valid form quietly", () => {
    expect(eventSpecProblem("click")).toBeNull()
    expect(eventSpecProblem("keydown.esc")).toBeNull()
    expect(eventSpecProblem("keydown.ctrl+shift+f@window")).toBeNull()
    expect(eventSpecProblem("keydown.escape@document")).toBeNull()
    expect(eventSpecProblem("meta+click")).toBeNull()
    expect(eventSpecProblem("library.change")).toBeNull()
    expect(eventSpecProblem("keydown.f1")).toBeNull()
    expect(eventSpecProblem("click@outside")).toBeNull()
  })

  test("flags a target it will never listen on", () => {
    expect(eventSpecProblem("keydown.esc@body")).toBe("names `@body` as its target. Use `@window`, `@document` or `@outside`, or drop the target to listen on the element.")
    expect(eventSpecProblem("click@")).toBe("names `@` as its target. Use `@window`, `@document` or `@outside`, or drop the target to listen on the element.")
  })

  test("flags a prefix that is not a modifier", () => {
    expect(eventSpecProblem("primary+click")).toBe("prefixes the event with `primary+`, which is not a modifier. Use `ctrl`, `alt`, `shift`, `meta` or `cmd`.")
  })

  test("flags an empty key filter", () => {
    expect(eventSpecProblem("keydown.")).toBe("has an empty key filter. Name the key after the dot, like `keydown.esc`, or drop the dot.")
    expect(eventSpecProblem("keydown.ctrl+")).toBe("has an empty key filter. Name the key after the dot, like `keydown.esc`, or drop the dot.")
  })

  test("flags a filter naming more than one key", () => {
    expect(eventSpecProblem("keydown.a+b")).toBe("filters on 2 keys. Name one key per clause, with modifiers joined by `+`, like `keydown.ctrl+k`.")
  })

  test("points the old dot chord at the plus form", () => {
    expect(eventSpecProblem("keydown.meta.k")).toBe("joins its filter with `.`. Join modifiers and key with `+`, like `keydown.meta+k`.")
  })
})
