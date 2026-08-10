import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Location, Position } from "@herb-tools/core"
import { colorize } from "@herb-tools/highlighter"

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

  test("colors the breadcrumb of a frame the same way as before when no call site is singled out", async () => {
    const root = project(files)
    const output = await render(processedFile(root, chain(frames)), root)

    expect(output).toContain(colorize("  <section>", "gray"))
    expect(output).toContain(colorize("  <html> › <body> › <main>", "gray"))
    expect(output).not.toContain("invalid on")
    expect(output).not.toContain("offending call site")
    expect(output).not.toContain("call sites unknown")
  })
})

describe("DetailedFormatter mixed call sites", () => {
  const files = {
    "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`,
    "app/views/posts/index.html.erb": `<table>\n  <%= render "posts/row" %>\n</table>\n`,
    "app/views/posts/_row.html.erb": `<div>\n  <style>.row {}</style>\n</div>\n`,
  }

  const frames: AncestorChain["frames"] = [
    { file: "app/views/layouts/application.html.erb", ancestors: ["html", "body", "main"], via: "layout", location: { line: 3, column: 10 } },
    { file: "app/views/posts/index.html.erb", ancestors: ["table"], via: "render", location: { line: 2, column: 2 } },
  ]

  function processedFile(root: string, offendingCallSites?: ProcessedFile["offendingCallSites"]): ProcessedFile {
    return {
      filename: join(root, "app/views/posts/_row.html.erb"),
      offense: offenseAt(2, 2),
      renderedFrom: chain(frames, 3),
      offendingCallSites,
    }
  }

  test("heads the chain with the share of call sites the offense applies to", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { offending: 1, total: 3 }), root))

    expect(output).toContain("invalid on 1 of 3 call sites")
  })

  test("says call site in the singular for a lone call site", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { offending: 0, total: 1 }), root))

    expect(output).not.toContain("invalid on")
  })

  test("marks the frame that nests the file in an offending element", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { offending: 1, total: 3, tags: ["table"] }), root))

    const rendered = output.split("\n").filter(line => line.includes("rendered "))

    expect(rendered[0]).toContain("← offending call site")
    expect(rendered[1]).not.toContain("← offending call site")
  })

  test("colors the offending element apart from the rest of the breadcrumb", async () => {
    const root = project(files)
    const output = await render(processedFile(root, { offending: 1, total: 3, tags: ["table"] }), root)

    expect(output).toContain(colorize("<table>", "yellow"))
    expect(output).toContain(colorize("<main>", "gray"))
  })

  test("marks no frame when the offending elements are not known", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { offending: 1, total: 3 }), root))

    expect(output).toContain("invalid on 1 of 3 call sites")
    expect(output).not.toContain("← offending call site")
  })

  test("heads nothing when every call site is at fault", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { offending: 3, total: 3 }), root))

    expect(output).not.toContain("invalid on")
    expect(output).toContain("rendered from app/views/posts/index.html.erb:2:2")
  })

  test("keeps the call chain of an offense without a split byte for byte", async () => {
    const root = project(files)
    const marked = await render(processedFile(root, { offending: 3, total: 3, tags: ["table"] }), root)
    const plainRail = await render(processedFile(root), root)

    expect(plainRail).toContain(colorize("  <table>", "gray"))
    expect(marked).toBe(plainRail)
  })
})

describe("DetailedFormatter unknown call sites", () => {
  const files = {
    "app/views/posts/_row.html.erb": `<div>\n  <style>.row {}</style>\n</div>\n`,
  }

  function processedFile(root: string, unknownCallSites?: ProcessedFile["unknownCallSites"]): ProcessedFile {
    return {
      filename: join(root, "app/views/posts/_row.html.erb"),
      offense: offenseAt(2, 2),
      unknownCallSites,
    }
  }

  test("says nothing for an offense whose call sites were resolved", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root), root))

    expect(output).not.toContain("call sites unknown")
  })

  test("names the renders that could not be resolved", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 0, unresolvedRenders: 2, skippedFiles: 0 }), root))

    expect(output).toContain("call sites unknown, 2 render calls in this project could not be resolved")
  })

  test("says render call in the singular for a single one", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 0, unresolvedRenders: 1, skippedFiles: 0 }), root))

    expect(output).toContain("call sites unknown, 1 render call in this project could not be resolved")
  })

  test("names the files left out of the index when every render resolved", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 0, unresolvedRenders: 0, skippedFiles: 3 }), root))

    expect(output).toContain("call sites unknown, 3 files were left out of the call site index")
  })

  test("says nothing renders the file when the index is complete", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 0, unresolvedRenders: 0, skippedFiles: 0 }), root))

    expect(output).toContain("call sites unknown, no file in this project renders it")
  })

  test("blames the callers when the file has some that lead nowhere", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 2, unresolvedRenders: 0, skippedFiles: 0 }), root))

    expect(output).toContain("call sites unknown, not every call site could be traced back to a document")
  })

  test("invents no frames for a file whose call sites are unknown", async () => {
    const root = project(files)
    const output = plain(await render(processedFile(root, { callers: 0, unresolvedRenders: 1, skippedFiles: 0 }), root))

    expect(output).not.toContain("rendered from")
    expect(output).not.toContain("rendered into")
  })
})
