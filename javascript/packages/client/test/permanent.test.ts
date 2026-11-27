import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import type { Payload } from "../src/types"

const FILE = "app/views/posts/_form.html.erb"

const EDITOR = `<div id="post_body_editor" data-herb-permanent="">server</div>`
const FIELD = `<label>Body</label>${EDITOR}`
const INVALID = `<label>Body</label>${EDITOR}<p class="error">can't be blank</p>`

function region(html: string): string {
  return `<!--herb-region:${FILE}:aaaaaaaa:0-->${html}<!--/herb-region:${FILE}-->`
}

function mounted(html: string): Slots {
  document.body.innerHTML = region(html)

  const index = new Slots()
  index.scan(document.body)

  return index
}

function payload(slots: Payload["slots"]): Payload {
  return { template: FILE, version: "aaaaaaaa", occurrence: 0, slots }
}

function typeInto(editor: Element): void {
  editor.innerHTML = `<div class="toolbar"></div><div contenteditable="true">typed</div>`
}

describe("a permanent element inside a slot", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("keeps the same element while the content around it updates", () => {
    const index = mounted(`<div class="field"><!--herb-slot:0-->${FIELD}<!--/herb-slot:0--></div>`)
    const editor = document.getElementById("post_body_editor")!

    typeInto(editor)

    const report = index.apply(payload({ 0: INVALID }))

    expect(report.applied).toBe(1)
    expect(document.getElementById("post_body_editor")).toBe(editor)
    expect(editor.textContent).toBe("typed")
    expect(document.querySelector(".error")?.textContent).toBe("can't be blank")
    expect(index.slot(FILE, 0)).not.toBeNull()
  })

  test("keeps it in a slot that is the whole content of an element", () => {
    const index = mounted(`<div class="field" data-herb-slot="0:child">${FIELD}</div>`)
    const editor = document.getElementById("post_body_editor")!

    typeInto(editor)

    const report = index.apply(payload({ 0: INVALID }))

    expect(report.applied).toBe(1)
    expect(document.getElementById("post_body_editor")).toBe(editor)
    expect(editor.textContent).toBe("typed")
    expect(document.querySelector(".field .error")?.textContent).toBe("can't be blank")
  })

  test("writes nothing when only the permanent element differs from the payload", () => {
    const index = mounted(`<div class="field"><!--herb-slot:0-->${FIELD}<!--/herb-slot:0--></div>`)
    const editor = document.getElementById("post_body_editor")!
    const label = document.querySelector("label")!

    typeInto(editor)

    const report = index.apply(payload({ 0: FIELD }))

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([])
    expect(document.querySelector("label")).toBe(label)
    expect(editor.textContent).toBe("typed")
  })

  test("writes nothing for a bare attribute the browser reads back with an empty value", () => {
    const bare = `<label>Body</label><div id="post_body_editor" data-herb-permanent>server</div>`
    const index = mounted(`<div class="field"><!--herb-slot:0-->${bare}<!--/herb-slot:0--></div>`)

    typeInto(document.getElementById("post_body_editor")!)

    expect(index.apply(payload({ 0: bare })).applied).toBe(0)
  })

  test("removes it when the payload no longer has an element with its id", () => {
    const index = mounted(`<div class="field"><!--herb-slot:0-->${FIELD}<!--/herb-slot:0--></div>`)

    typeInto(document.getElementById("post_body_editor")!)

    const report = index.apply(payload({ 0: `<label>Body</label><p>Read only</p>` }))

    expect(report.applied).toBe(1)
    expect(document.getElementById("post_body_editor")).toBeNull()
    expect(document.querySelector(".field")?.textContent).toBe("BodyRead only")
  })

  test("keeps a permanent element inside another one where it was", () => {
    const nested = `<div id="post_body_field" data-herb-permanent="">${EDITOR}</div>`
    const index = mounted(`<div class="field"><!--herb-slot:0--><label>Body</label>${nested}<!--/herb-slot:0--></div>`)
    const field = document.getElementById("post_body_field")!
    const editor = document.getElementById("post_body_editor")!

    typeInto(editor)

    index.apply(payload({ 0: `<label>Body</label>${nested}<p class="error">can't be blank</p>` }))

    expect(document.getElementById("post_body_field")).toBe(field)
    expect(field.contains(editor)).toBe(true)
    expect(editor.textContent).toBe("typed")
  })

  test("keeps focus inside it when the content around it updates", () => {
    const index = mounted(`<div class="field"><!--herb-slot:0--><label>Tags</label><div id="post_tags" data-herb-permanent=""><input></div><!--/herb-slot:0--></div>`)
    const input = document.querySelector("input")!

    input.focus()

    index.apply(payload({ 0: `<label>Tags</label><div id="post_tags" data-herb-permanent=""><input></div><p class="error">is invalid</p>` }))

    expect(document.querySelector("input")).toBe(input)
    expect(document.activeElement).toBe(input)
  })
})

describe("a slot inside a permanent element", () => {
  test("is not written from a payload", () => {
    const index = mounted(`<div id="post_body_editor" data-herb-permanent=""><!--herb-slot:0-->server<!--/herb-slot:0--></div>`)
    const editor = document.getElementById("post_body_editor")!

    const report = index.apply(payload({ 0: "other" }))

    expect(report.applied).toBe(0)
    expect(editor.textContent).toBe("server")
  })
})

describe("a block around a permanent element", () => {
  test("is covered by its interior when only the permanent element differs", () => {
    const index = mounted(`<!--herb-slot:0:block--><form><!--herb-slot:1-->${FIELD}<!--/herb-slot:1--></form><!--/herb-slot:0-->`)
    const editor = document.getElementById("post_body_editor")!

    typeInto(editor)

    const report = index.apply(payload({ 0: `<form>${FIELD}</form>`, 1: FIELD }))

    expect(report.deferred).toEqual([])
    expect(report.applied).toBe(0)
    expect(editor.textContent).toBe("typed")
  })
})
