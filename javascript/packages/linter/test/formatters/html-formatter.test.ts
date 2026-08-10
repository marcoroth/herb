import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Location, Position } from "@herb-tools/core"

import { HTMLFormatter } from "../../src/cli/formatters/html-formatter.js"

import type { AncestorChain, Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../../src/cli/file-processor.js"

const projects: string[] = []

const FILES = {
  "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`,
  "app/views/posts/index.html.erb": `<table>\n  <%= render "posts/row" %>\n</table>\n`,
  "app/views/posts/show.html.erb": `<section>\n  <%= render "posts/row" %>\n</section>\n`,
  "app/views/posts/edit.html.erb": `<table>\n  <%= render "posts/row" %>\n</table>\n`,
  "app/views/posts/_row.html.erb": `<div>\n  <style>.row {}</style>\n</div>\n`,
}

const LAYOUT_FRAME: AncestorChain["frames"][number] = {
  file: "app/views/layouts/application.html.erb",
  ancestors: ["html", "body", "main"],
  via: "layout",
  location: { line: 3, column: 10 },
}

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-html-formatter-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function offenseAt(line: number, column: number): Diagnostic {
  return {
    message: "Element `<style>` must be placed inside the `<head>` tag.",
    location: new Location(new Position(line, column), new Position(line, column + 5)),
    severity: "error",
    code: "html-head-only-elements",
    source: "Herb Linter",
  }
}

function chainThrough(caller: string, ancestors: string[], occurrences = 1): AncestorChain {
  const frame = { file: caller, ancestors, via: "render" as const, location: { line: 2, column: 2 } }

  return {
    tags: [...LAYOUT_FRAME.ancestors, ...ancestors],
    frames: [LAYOUT_FRAME, frame],
    occurrences,
  }
}

async function render(processed: ProcessedFile, projectPath: string): Promise<string> {
  const lines: string[] = []
  const spy = vi.spyOn(console, "log").mockImplementation(message => { lines.push(String(message)) })

  try {
    await new HTMLFormatter(projectPath).format([processed])
  } finally {
    spy.mockRestore()
  }

  return lines.join("\n")
}

function othersSection(html: string): string {
  const start = html.indexOf(`<details class="herb-report-others">`)

  if (start === -1) return ""

  return html.slice(start, html.indexOf("</details>", start) + "</details>".length)
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("HTMLFormatter other call sites", () => {
  function processedFile(root: string, otherCallSites?: AncestorChain[], offendingCallSites?: ProcessedFile["offendingCallSites"]): ProcessedFile {
    return {
      filename: join(root, "app/views/posts/_row.html.erb"),
      offense: offenseAt(2, 2),
      renderedFrom: chainThrough("app/views/posts/index.html.erb", ["table"]),
      otherCallSites,
      offendingCallSites,
    }
  }

  test("lists the call sites the render stack leaves out, collapsed", async () => {
    const root = project(FILES)

    const others = [
      chainThrough("app/views/posts/show.html.erb", ["section"]),
      chainThrough("app/views/posts/edit.html.erb", ["table"]),
    ]

    const html = await render(processedFile(root, others), root)
    const section = othersSection(html)

    expect(section).toContain(`<summary class="herb-report-others-summary">Also rendered from 2 other call sites</summary>`)
    expect(section).not.toContain(`<details class="herb-report-others" open>`)
    expect(html).not.toContain(`<details class="herb-report-others" open>`)
    expect(section).toContain("app/views/posts/show.html.erb:2:2")
    expect(section).toContain("app/views/posts/edit.html.erb:2:2")
    expect(section.match(/class="herb-report-other"/g)).toHaveLength(2)
  })

  test("says call site in the singular for a lone other one", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [chainThrough("app/views/posts/show.html.erb", ["section"])]), root)

    expect(othersSection(html)).toContain("Also rendered from 1 other call site")
  })

  test("marks an other call site that offends as well", async () => {
    const root = project(FILES)

    const others = [
      chainThrough("app/views/posts/show.html.erb", ["section"]),
      chainThrough("app/views/posts/edit.html.erb", ["table"]),
    ]

    const html = await render(processedFile(root, others, { offending: 2, total: 3, tags: ["table"] }), root)
    const section = othersSection(html)

    expect(section).toContain(`<li class="herb-report-other herb-report-other-offending">`)
    expect(section.match(/herb-report-other-offending/g)).toHaveLength(1)
    expect(section).toContain(`<span class="herb-report-frame-marker">offending call site</span>`)
    expect(section).toContain(`<span class="herb-report-tag herb-report-tag-offending">&lt;table&gt;</span>`)
  })

  test("renders the ancestors of every other call site", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [chainThrough("app/views/posts/show.html.erb", ["section"])]), root)

    expect(othersSection(html)).toContain(`<span class="herb-report-tag">&lt;section&gt;</span>`)
    expect(othersSection(html)).toContain(`<span class="herb-report-tag">&lt;main&gt;</span>`)
  })

  test("says how many call sites an other chain stands for", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [chainThrough("app/views/posts/show.html.erb", ["section"], 3)]), root)

    expect(othersSection(html)).toContain(`<span class="herb-report-other-repeat">3 call sites nest it this way</span>`)
  })

  test("says nothing about occurrences for a chain that stands for one call site", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [chainThrough("app/views/posts/show.html.erb", ["section"])]), root)

    expect(othersSection(html)).not.toContain("herb-report-other-repeat")
  })

  test("labels every other call site with the project-relative path", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [chainThrough("app/views/posts/show.html.erb", ["section"])]), root)

    expect(othersSection(html)).not.toContain(root)
  })

  test("renders no section for a file with a single call site", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root), root)

    expect(html).toContain(`<section class="herb-report-chain">`)
    expect(othersSection(html)).toBe("")
    expect(html).not.toContain("other call site")
  })

  test("renders no section when the other chains carry no frames", async () => {
    const root = project(FILES)
    const html = await render(processedFile(root, [{ tags: [], frames: [], occurrences: 1 }]), root)

    expect(othersSection(html)).toBe("")
  })
})
