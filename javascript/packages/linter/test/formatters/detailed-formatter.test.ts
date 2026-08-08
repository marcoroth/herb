import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Location, Position } from "@herb-tools/core"

import { DetailedFormatter } from "../../src/cli/formatters/detailed-formatter.js"

import type { AncestorChain, Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../../src/cli/file-processor.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-formatter-"))

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

function chain(frames: AncestorChain["frames"], occurrences = 1): AncestorChain {
  return { tags: frames.flatMap(frame => frame.ancestors), frames, occurrences }
}

async function render(processed: ProcessedFile, projectPath: string): Promise<string> {
  const lines: string[] = []
  const spy = vi.spyOn(console, "log").mockImplementation(message => { lines.push(String(message)) })

  try {
    await new DetailedFormatter(undefined, false, false, projectPath).format([processed], false)
  } finally {
    spy.mockRestore()
  }

  return lines.join("\n")
}

function plain(output: string): string {
  return output.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "")
}

function linkTargets(output: string): string[] {
  return [...output.matchAll(/\x1b\]8;;(file:[^\x1b]+)\x1b\\/g)].map(match => match[1])
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("DetailedFormatter call chain", () => {
  const files = {
    "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`,
    "app/views/posts/index.html.erb": `<section>\n  <%= render "posts/card" %>\n</section>\n`,
    "app/views/posts/_card.html.erb": `<div>\n  <style>.card {}</style>\n</div>\n`,
  }

  const frames: AncestorChain["frames"] = [
    { file: "app/views/layouts/application.html.erb", ancestors: ["html", "body", "main"], via: "layout", location: { line: 3, column: 10 } },
    { file: "app/views/posts/index.html.erb", ancestors: ["section"], via: "render", location: { line: 2, column: 2 } },
  ]

  function processedFile(root: string, renderedFrom?: AncestorChain): ProcessedFile {
    return {
      filename: join(root, "app/views/posts/_card.html.erb"),
      offense: offenseAt(2, 2),
      renderedFrom,
    }
  }

  test("renders one frame per call site, innermost first", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames)), root))

    const rendered = output.split("\n").filter(line => line.includes("rendered "))

    expect(rendered).toHaveLength(2)
    expect(rendered[0]).toContain("rendered from app/views/posts/index.html.erb:2:2")
    expect(rendered[1]).toContain("rendered into app/views/layouts/application.html.erb:3:10")
  })

  test("labels each frame with the project-relative path", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames)), root))

    expect(output).not.toContain(root)
    expect(output).toContain("app/views/posts/index.html.erb:2:2")
  })

  test("links each frame to the absolute path", async () => {
    const root = project(files)
    const output = await render(processedFile(root, chain(frames)), root)

    expect(linkTargets(output)).toEqual(
      expect.arrayContaining([
        `file://${join(root, "app/views/posts/index.html.erb")}`,
        `file://${join(root, "app/views/layouts/application.html.erb")}`,
      ]),
    )
  })

  test("labels the offending file relatively and links it absolutely", async () => {
    const root = project(files)
    const output = await render(processedFile(root, chain(frames)), root)

    expect(plain(output)).toContain("app/views/posts/_card.html.erb:2:2")
    expect(plain(output)).not.toContain(root)
    expect(linkTargets(output)).toContain(`file://${join(root, "app/views/posts/_card.html.erb")}`)
  })

  test("shows the source line each frame points at", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames)), root))

    expect(output).toContain(`<%= render "posts/card" %>`)
    expect(output).toContain(`<main><%= yield %></main>`)
  })

  test("names the enclosing elements of each frame", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames)), root))

    expect(output).toContain("<section>")
    expect(output).toContain("<html> › <body> › <main>")
  })

  test("counts the other call sites that nest the file the same way", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames, 3)), root))

    expect(output).toContain("and 2 other call sites nesting it the same way")
  })

  test("says call site in the singular for a single other one", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain(frames, 2)), root))

    expect(output).toContain("and 1 other call site nesting it the same way")
  })

  test("renders no chain for an offense without one", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root), root))

    expect(output).not.toContain("rendered from")
    expect(output).not.toContain("rendered into")
  })

  test("renders no chain for an empty frame list", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, chain([])), root))

    expect(output).not.toContain("rendered from")
  })

  test("skips a frame whose file cannot be read", async () => {
    const root = project(files)
    const missing: AncestorChain["frames"] = [
      { file: "app/views/posts/_gone.html.erb", ancestors: ["div"], via: "render", location: { line: 1, column: 0 } },
    ]

    const output = plain(await render(processedFile(root, chain(missing)), root))

    expect(output).not.toContain("rendered from")
  })

  test("skips a frame that has no location", async () => {
    const root = project(files)
    const located: AncestorChain["frames"] = [
      { file: "app/views/posts/index.html.erb", ancestors: ["section"], via: "render", location: null },
    ]

    const output = plain(await render(processedFile(root, chain(located)), root))

    expect(output).not.toContain("rendered from")
  })
})
