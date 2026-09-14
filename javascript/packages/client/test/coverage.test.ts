import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Slots } from "../src/slots/slots"
import { watchCoverage } from "../src/shared/coverage"
import { resetReport } from "../src/shared/report"

const FILE = "app/views/page/covered.html.erb"

describe("a page with controls and no regions", () => {
  let entries: { code: string; severity: string; template: string }[]
  let stop: () => void

  function watch(markup: string): void {
    document.body.innerHTML = markup

    const slots = new Slots()

    slots.scan(document.body)

    stop = watchCoverage(slots)
  }

  beforeEach(() => {
    resetReport()

    entries = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input as { code: string; severity: string; template: string }),
    }
  })

  afterEach(() => {
    stop?.()
    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("says so once, naming the page and what to add", () => {
    watch(`<section><button data-herb-toggle="open">Details</button></section>`)

    expect(entries.map((entry) => [entry.code, entry.severity, entry.template])).toEqual([
      ["herb-no-regions", "warning", window.location.href],
    ])
  })

  test("says it once however many controls the page carries", () => {
    watch(
      `<section>` +
        `<button data-herb-toggle="open">a</button>` +
        `<button data-herb-reset="sort">b</button>` +
        `<button data-herb-increment="attempts">c</button>` +
        `</section>`,
    )

    expect(entries.length).toBe(1)
  })

  test("stays quiet on an ordinary page, which has neither", () => {
    watch(`<section><p>Nothing dynamic here</p></section>`)

    expect(entries).toEqual([])
  })

  test("stays quiet when the page has a region, since the controls have somewhere to resolve", () => {
    watch(
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
        `<section><button data-herb-toggle="open">Details</button></section>` +
        `<!--/herb-region:${FILE}-->`,
    )

    expect(entries).toEqual([])
  })
})
