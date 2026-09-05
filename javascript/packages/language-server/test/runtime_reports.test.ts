import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

import { RuntimeReports, templateDigest, shortDigest } from "../src/runtime_reports"

const TEMPLATE = "app/views/posts/_card.html.erb"
const SOURCE = "<div><%= post.title %></div>"
const REPOSITORY = resolve(__dirname, "../../../..")

function record(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 1,
    t: "finding",
    at: "2026-08-14T20:11:04.221Z",
    run: "20260814T201104-abcdef0123",
    line: 7,
    column: 8,
    end_line: 7,
    end_column: 24,
    code: "sql-queries",
    origin: "Herb Engine",
    kind: "metric",
    message: "3 SQL queries",
    value: "3 SQL queries",
    ...overrides,
  })
}

function header(digest: string) {
  return JSON.stringify({
    v: 1,
    t: "template",
    path: TEMPLATE,
    digest,
    first_seen: "2026-08-14T20:11:04.221Z",
  })
}

describe("templateDigest", () => {
  test("is stable for the same text", () => {
    expect(templateDigest(SOURCE)).toEqual(templateDigest(SOURCE))
  })

  test("moves when the text moves", () => {
    expect(templateDigest(SOURCE)).not.toEqual(templateDigest(`${SOURCE} `))
  })

  test("ignores a byte order mark", () => {
    expect(templateDigest(SOURCE)).toEqual(templateDigest(`﻿${SOURCE}`))
  })

  test("keeps line endings apart", () => {
    expect(templateDigest("<div>\n</div>")).not.toEqual(templateDigest("<div>\r\n</div>"))
  })

  test("shortens to what fits in a filename", () => {
    expect(shortDigest(templateDigest(SOURCE))).toHaveLength(8)
  })
})

describe("agreeing with the Ruby digest", () => {
  const cases: Record<string, string> = {
    plain: "<div></div>",
    "with a byte order mark": "﻿<div></div>",
    "with CRLF line endings": "<div>\r\n</div>",
    "without a trailing newline": "<div>\n  <span></span>\n</div>",
    "with a trailing newline": "<div>\n  <span></span>\n</div>\n",
    "with multibyte text": "<div>café ☕ 日本語</div>",
    empty: "",
  }

  test.each(Object.entries(cases))("matches Ruby for a template %s", (_name, source) => {
    const ruby = execFileSync(
      "ruby",
      [
        "-Ilib",
        "-rherb/fingerprint",
        "-e",
        "print Herb::Fingerprint.template(STDIN.binmode.read)",
      ],
      { cwd: REPOSITORY, input: Buffer.from(source, "utf8") },
    ).toString()

    expect(ruby).toEqual(templateDigest(source))
  })
})

describe("RuntimeReports", () => {
  let root: string
  let reports: RuntimeReports

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "herb-runtime-"))
    reports = new RuntimeReports(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function shard(lines: string[], source = SOURCE) {
    const path = reports.shardPath(TEMPLATE, templateDigest(source))

    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${lines.join("\n")}\n`)

    return path
  }

  test("says nothing about a template nobody rendered", () => {
    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)).toEqual([])
    expect(reports.shardFor(TEMPLATE, SOURCE)).toBeNull()
  })

  test("says nothing about a document it cannot place in the project", () => {
    expect(reports.inlayHintsFor(null, SOURCE)).toEqual([])
  })

  test("says nothing once the buffer stops being the text that was rendered", () => {
    shard([header(templateDigest(SOURCE)), record()])

    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)).toHaveLength(1)
    expect(reports.inlayHintsFor(TEMPLATE, `${SOURCE}<p>typing</p>`)).toEqual([])
  })

  test("sits after the tag closes rather than splitting it", () => {
    shard([header(templateDigest(SOURCE)), record()])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)

    expect(hint.position).toEqual({ line: 6, character: 23 })
    expect(hint.label).toEqual("(3 SQL queries)")
    expect(hint.paddingLeft).toBe(true)
  })

  test("annotates the line a multi-line tag opens on, not the `end` many lines below", () => {
    const block = "<% posts.each do |post| %>\n  <span></span>\n<% end %>\n"

    shard([header(templateDigest(block)), record({ line: 1, column: 1, end_line: 3, end_column: 10 })], block)

    const [hint] = reports.inlayHintsFor(TEMPLATE, block)

    expect(hint.position).toEqual({ line: 0, character: "<% posts.each do |post| %>".length })
  })

  test("knows the whole span of the tag, not just where it starts", () => {
    shard([header(templateDigest(SOURCE)), record()])

    const [finding] = reports.shardFor(TEMPLATE, SOURCE)!.findings

    expect([finding.line, finding.column]).toEqual([7, 8])
    expect([finding.endLine, finding.endColumn]).toEqual([7, 24])
  })

  test("falls back to the start for a finding recorded without an end", () => {
    shard([header(templateDigest(SOURCE)), record({ end_line: undefined, end_column: undefined })])

    const [finding] = reports.shardFor(TEMPLATE, SOURCE)!.findings

    expect([finding.endLine, finding.endColumn]).toEqual([7, 8])
  })

  test("shows the statements behind a count, since the number alone is not actionable", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ data: { queries: ["SELECT 1 FROM posts", "SELECT 2 FROM posts"] } }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain("```sql")
    expect(tooltip).toContain("SELECT 1 FROM posts")
    expect(tooltip).toContain("SELECT 2 FROM posts")
    expect(tooltip).toContain("recorded by Herb Engine")
  })

  test("puts a blank line between statements long enough to wrap into each other", () => {
    const first = `SELECT "events".* FROM "events" WHERE "events"."id" IN (20, 320, 137, 556, 85) ORDER BY "events"."id"`
    const second = `SELECT "talks".* FROM "talks" WHERE "talks"."event_id" IN (20, 320, 137, 556, 85) ORDER BY "talks"."id"`

    shard([
      header(templateDigest(SOURCE)),
      record({ data: { queries: [first, second] } }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain(`${first}\n\n${second}`)
  })

  test("leaves observations that fit on a line packed together", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({
        code: "render-time",
        message: "1.6 ms",
        value: "1.6 ms",
        data: { render: [{ duration: 1.6, gc: 0.0 }, { duration: 2.4, gc: 0.1 }] },
      }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain("duration: 1.6  gc: 0\nduration: 2.4  gc: 0.1")
  })

  test("spells out an observation that is an object rather than printing its type", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({
        code: "render-time",
        message: "1.6 ms",
        value: "1.6 ms",
        data: { render: [{ duration: 1.6, gc: 0.0, allocations: 3373 }] },
      }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).not.toContain("[object Object]")
    expect(tooltip).toContain("duration: 1.6")
    expect(tooltip).toContain("allocations: 3373")
  })

  test("shows the statements from the worst request, not the most recent one", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ value: "47 SQL queries", message: "47 SQL queries", data: { queries: ["SELECT worst"] } }),
      record({ value: "3 SQL queries", message: "3 SQL queries", at: "2026-08-14T23:00:00.000Z", data: { queries: ["SELECT latest"] } }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(hint.label).toEqual("(3 to 47 SQL queries)")
    expect(tooltip).toContain("SELECT worst")
    expect(tooltip).not.toContain("SELECT latest")
  })

  test("puts the producer's own sentence in the tooltip, not in the label", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ description: "This ERB tag ran 3 SQL queries while the page rendered." }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(hint.label).toEqual("(3 SQL queries)")
    expect(tooltip).toContain("This ERB tag ran 3 SQL queries while the page rendered.")
  })

  test("says nothing extra when the producer wrote no sentence", () => {
    shard([header(templateDigest(SOURCE)), record()])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain("**3 SQL queries**")
    expect(tooltip).not.toContain("undefined")
  })

  test("says when it kept only the head of what was observed", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ data: { queries: ["SELECT 1"] }, data_trimmed: true }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain("showing 1 of them")
  })

  test("shows a value-bearing finding in place of the tag rather than beside it", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", code: "rendered-output", message: "Upcoming events", value: "Upcoming events" }),
    ])

    const [overlay] = reports.overlaysFor(TEMPLATE, SOURCE)

    expect(overlay.text).toEqual("Upcoming events")
    expect(overlay.range.start).toEqual({ line: 6, character: 7 })
    expect(overlay.range.end).toEqual({ line: 6, character: 23 })
    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)).toEqual([])
  })

  test("falls back to a hint for a client that cannot draw over the tag", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", code: "rendered-output", message: "Upcoming events", value: "Upcoming events" }),
    ])

    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)).toEqual([])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE, true)

    expect(hint.label).toEqual("(Upcoming events)")
  })

  test("keeps the last few things the tag produced, newest first", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", value: "gamma", data: { output: ["alpha", "beta", "gamma"] } }),
      record({ kind: "value", value: "epsilon", at: "2026-08-15T09:00:00.000Z", data: { output: ["delta", "epsilon"] } }),
    ])

    const [overlay] = reports.overlaysFor(TEMPLATE, SOURCE)

    expect(overlay.recent.map(entry => entry.value)).toEqual(["epsilon", "delta", "gamma", "beta", "alpha"])
    expect(overlay.text).toEqual("epsilon")
  })

  test("falls back to the recorded value when the tag observed nothing itself", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", value: "first" }),
      record({ kind: "value", value: "second", at: "2026-08-15T09:00:00.000Z" }),
    ])

    expect(reports.overlaysFor(TEMPLATE, SOURCE)[0].recent.map(entry => entry.value)).toEqual(["second", "first"])
  })

  test("takes the later record when two share a timestamp, since a shard is appended to", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", value: "older" }),
      record({ kind: "value", value: "newer" }),
    ])

    expect(reports.overlaysFor(TEMPLATE, SOURCE)[0].text).toEqual("newer")
  })

  test("shows the history in the hint tooltip for a client that cannot draw over the tag", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", value: "gamma", data: { output: ["alpha", "beta", "gamma"] } }),
    ])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE, true)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).toContain("Last 3 renders")
    expect(tooltip).toContain("- gamma")
    expect(tooltip).toContain("- alpha")
  })

  test("says nothing about a history of a tag that rendered the same thing every time", () => {
    shard([header(templateDigest(SOURCE)), record(), record({ at: "2026-08-15T09:00:00.000Z" })])

    const [hint] = reports.inlayHintsFor(TEMPLATE, SOURCE)
    const tooltip = typeof hint.tooltip === "string" ? hint.tooltip : hint.tooltip!.value

    expect(tooltip).not.toContain("Last")
  })

  test("counts a render tag against the parent render it happened in", () => {
    shard([
      header(templateDigest(SOURCE)),
      JSON.stringify({
        v: 1, t: "call", at: "2026-08-14T20:11:04.221Z", run: "r1", request_path: "/posts",
        line: 3, column: 5, via: "partial",
        targets: { "app/views/posts/_card.html.erb": 3 },
        parents: 1, renders: 3, per_parent: { "3": 1 },
      }),
    ])

    const [call] = reports.callsFor(TEMPLATE, SOURCE)

    expect(call.perParent).toEqual({ 3: 1 })
    expect(call.peak).toEqual(3)
    expect(call.onlyTarget).toEqual("app/views/posts/_card.html.erb")
    expect(call.observed).toEqual(1)
    expect(call.paths).toEqual({ "/posts": 1 })
  })

  test("merges the histogram across requests instead of summing it away", () => {
    const record = (per: Record<string, number>, renders: number) => JSON.stringify({
      v: 1, t: "call", at: "2026-08-14T20:11:04.221Z", line: 3, column: 5,
      targets: { "app/views/posts/_card.html.erb": renders },
      parents: 1, renders, per_parent: per,
    })

    shard([header(templateDigest(SOURCE)), record({ "3": 1 }, 3), record({ "1": 1 }, 1)])

    const [call] = reports.callsFor(TEMPLATE, SOURCE)

    expect(call.perParent).toEqual({ 3: 1, 1: 1 })
    expect(call.peak).toEqual(3)
    expect(call.renders).toEqual(4)
    expect(call.observed).toEqual(2)
  })

  test("names no single target once a tag resolved to more than one thing", () => {
    shard([
      header(templateDigest(SOURCE)),
      JSON.stringify({
        v: 1, t: "call", at: "2026-08-14T20:11:04.221Z", line: 3, column: 5,
        targets: { "a.html.erb": 2, "b.html.erb": 1 }, parents: 1, renders: 3, per_parent: { "3": 1 },
      }),
    ])

    expect(reports.callsFor(TEMPLATE, SOURCE)[0].onlyTarget).toBeNull()
  })

  test("says nothing about calls once the buffer stops being the text that was rendered", () => {
    shard([
      header(templateDigest(SOURCE)),
      JSON.stringify({ v: 1, t: "call", at: "2026-08-14T20:11:04.221Z", line: 3, column: 5, per_parent: { "1": 1 } }),
    ])

    expect(reports.callsFor(TEMPLATE, `${SOURCE}<p>typing</p>`)).toEqual([])
  })

  test("leaves a measurement as a hint beside the tag", () => {
    shard([header(templateDigest(SOURCE)), record()])

    expect(reports.overlaysFor(TEMPLATE, SOURCE)).toEqual([])
    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)).toHaveLength(1)
  })

  test("stops overlaying once the buffer stops being the text that was rendered", () => {
    shard([header(templateDigest(SOURCE)), record({ kind: "value", value: "Upcoming events" })])

    expect(reports.overlaysFor(TEMPLATE, `${SOURCE}<p>typing</p>`)).toEqual([])
  })

  test("overlays the most recent value, since that is what the tag renders now", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ kind: "value", value: "Old title", message: "Old title" }),
      record({ kind: "value", value: "New title", message: "New title", at: "2026-08-15T09:00:00.000Z" }),
    ])

    expect(reports.overlaysFor(TEMPLATE, SOURCE)[0].text).toEqual("New title")
  })

  test("folds every occurrence of one finding into one", () => {
    shard([header(templateDigest(SOURCE)), record(), record(), record()])

    const found = reports.shardFor(TEMPLATE, SOURCE)!.findings

    expect(found).toHaveLength(1)
    expect(found[0].count).toEqual(3)
  })

  test("reports the spread across requests, which no single request could", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ value: "3 SQL queries", message: "3 SQL queries" }),
      record({ value: "47 SQL queries", message: "47 SQL queries", at: "2026-08-14T20:12:04.221Z" }),
      record({ value: "3 SQL queries", message: "3 SQL queries" }),
    ])

    const [finding] = reports.shardFor(TEMPLATE, SOURCE)!.findings

    expect(finding.range).toEqual({ min: 3, max: 47 })
    expect(reports.inlayHintsFor(TEMPLATE, SOURCE)[0].label).toEqual("(3 to 47 SQL queries)")
  })

  test("leaves the spread alone when what was measured is not a number", () => {
    shard([header(templateDigest(SOURCE)), record({ value: "slow" }), record({ value: "slower" })])

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings[0].range).toBeNull()
  })

  test("keeps findings at different places apart, in the order they are read in", () => {
    shard([
      header(templateDigest(SOURCE)),
      record({ line: 9 }),
      record({ line: 7 }),
    ])

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings.map(finding => finding.line)).toEqual([7, 9])
  })

  test("carries what was dropped, so a spread is not read as the truth when it is a floor", () => {
    shard([header(templateDigest(SOURCE)), JSON.stringify({ v: 1, t: "truncated", dropped: 40 }), record()])

    expect(reports.shardFor(TEMPLATE, SOURCE)!.dropped).toEqual(40)
  })

  test("skips a record written by a version it does not know", () => {
    shard([header(templateDigest(SOURCE)), record(), JSON.stringify({ v: 99, t: "finding", line: 1, column: 1 })])

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings).toHaveLength(1)
  })

  test("loses a torn write and nothing behind it", () => {
    const path = shard([header(templateDigest(SOURCE)), record()])

    appendFileSync(path, '{"v":1,"t":"finding","li')

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings).toHaveLength(1)
  })

  test("re-reads a shard once the renderer appends to it", () => {
    const path = shard([header(templateDigest(SOURCE)), record()])

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings[0].count).toEqual(1)

    appendFileSync(path, `${record({ at: "2026-08-14T20:13:04.221Z" })}\n`)

    expect(reports.shardFor(TEMPLATE, SOURCE)!.findings[0].count).toEqual(2)
  })
})
