import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { describe, test, expect, beforeAll, afterEach } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { FileProcessor } from "../src/cli/file-processor.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-file-processor-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

const LAYOUT = `<html>\n  <head>\n    <title>Site</title>\n  </head>\n\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`

describe("FileProcessor", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  afterEach(() => {
    while (projects.length > 0) {
      rmSync(projects.pop()!, { recursive: true, force: true })
    }
  })

  test("doesn't inline file content into offenses", async () => {
    const processor = new FileProcessor()
    const result = await processor.processFiles(["test/fixtures/multiple-rule-offenses.html.erb"], "simple")

    expect(result.allOffenses.length).toBeGreaterThan(0)

    for (const offense of result.allOffenses) {
      expect(offense.content).toBeUndefined()
    }
  })

  test("marks a partial reached only through a dynamic render as unresolved", async () => {
    const projectPath = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render row_partial %>\n</section>\n`,
      "app/views/posts/_row.html.erb": `<div>\n  <IMG src="/icon.png">\n</div>\n`,
    })

    const processor = new FileProcessor()
    const result = await processor.processFiles(["app/views/posts/_row.html.erb"], "simple", { projectPath, only: ["html-tag-name-lowercase"] })

    expect(result.allOffenses.length).toBeGreaterThan(0)
    expect(result.allOffenses[0].unknownCallSites).toEqual({ callers: 0, unresolvedRenders: 1, skippedFiles: 0 })
  })

  test("leaves a partial with a resolved call site alone", async () => {
    const projectPath = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render "posts/row" %>\n</section>\n`,
      "app/views/posts/_row.html.erb": `<div>\n  <IMG src="/icon.png">\n</div>\n`,
    })

    const processor = new FileProcessor()
    const result = await processor.processFiles(["app/views/posts/_row.html.erb"], "simple", { projectPath, only: ["html-tag-name-lowercase"] })

    expect(result.allOffenses.length).toBeGreaterThan(0)
    expect(result.allOffenses[0].unknownCallSites).toBeUndefined()
  })

  test("says nothing about the call sites of a template that is not a partial", async () => {
    const projectPath = project({
      "app/views/posts/index.html.erb": `<div>\n  <IMG src="/icon.png">\n</div>\n`,
    })

    const processor = new FileProcessor()
    const result = await processor.processFiles(["app/views/posts/index.html.erb"], "simple", { projectPath, only: ["html-tag-name-lowercase"] })

    expect(result.allOffenses.length).toBeGreaterThan(0)
    expect(result.allOffenses[0].unknownCallSites).toBeUndefined()
  })
})
