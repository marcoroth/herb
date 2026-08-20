import { describe, test, expect, beforeAll, afterEach } from "vitest"

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

import { Herb } from "@herb-tools/node-wasm"

import { ProjectIndex } from "../src/project-index"

const FILES = {
  "app/views/posts/index.html.erb": `<%= render "posts/card", post: post %>\n`,
  "app/views/posts/_card.html.erb": `<%# locals: (post:) %>\n<article></article>\n`,
  "app/views/shared/_header.html.erb": `<header></header>\n`,
}

describe("ProjectIndex", () => {
  let root: string

  beforeAll(async () => {
    await Herb.load()
  })

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  function projectWith(files: Record<string, string>): string {
    root = mkdtempSync(join(tmpdir(), "herb-index-"))

    for (const [path, contents] of Object.entries(files)) {
      const file = join(root, path)

      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, contents, "utf-8")
    }

    return root
  }

  function uriFor(path: string): string {
    return pathToFileURL(join(root, path)).toString()
  }

  async function analyzerFor(files: Record<string, string> = FILES): Promise<ProjectIndex> {
    const index = new ProjectIndex({ root: projectWith(files), backend: Herb })

    await index.indexAll()

    return index
  }

  describe("indexAll", () => {
    test("indexes the partials and the call sites together", async () => {
      const index = await analyzerFor()

      expect(index.partials?.size).toBe(2)
      expect(index.callers?.size).toBeGreaterThan(0)
    })

    test("reports the view root it found", async () => {
      const index = await analyzerFor()

      expect(index.viewRoots).toEqual(["app/views"])
    })

    test("falls back to the project root when there is no app/views", async () => {
      const index = await analyzerFor({ "templates/_card.html.erb": `<article></article>\n` })

      expect(index.viewRoots).toEqual(["."])
    })
  })

  describe("relativePathFor", () => {
    test("answers with a project relative path", async () => {
      const index = await analyzerFor()

      expect(index.relativePathFor(uriFor("app/views/posts/_card.html.erb"))).toBe("app/views/posts/_card.html.erb")
    })

    test("refuses a document outside the project", async () => {
      const index = await analyzerFor()

      expect(index.relativePathFor("file:///somewhere/else/a.html.erb")).toBeNull()
    })

    test("refuses a document that has no path", async () => {
      const index = await analyzerFor()

      expect(index.relativePathFor("untitled:Untitled-1")).toBeNull()
    })
  })

  describe("handleChange", () => {
    test("takes a new strict locals declaration from the given source", async () => {
      const index = await analyzerFor()
      const uri = uriFor("app/views/posts/_card.html.erb")

      expect(index.handleChange(uri, `<%# locals: (post:, featured: false) %>\n`)).toBe(true)

      const declaration = index.partials?.lookup("posts/card", undefined)

      expect(declaration?.locals.map(local => local.name)).toContain("featured")
    })

    test("reads from disk when no source is given", async () => {
      const index = await analyzerFor()

      writeFileSync(join(root, "app/views/posts/_card.html.erb"), `<%# locals: (post:, rank: 1) %>\n`, "utf-8")

      expect(index.handleChange(uriFor("app/views/posts/_card.html.erb"))).toBe(true)
      expect(index.partials?.lookup("posts/card", undefined)?.locals.map(local => local.name)).toContain("rank")
    })

    test("picks up a render call added to a template", async () => {
      const index = await analyzerFor()
      const uri = uriFor("app/views/posts/index.html.erb")

      index.handleChange(uri, `<%= render "shared/header" %>\n`)

      expect(index.callers?.contextOf("app/views/shared/_header.html.erb")).toBeDefined()
    })

    test("ignores a document outside the project", async () => {
      const index = await analyzerFor()

      expect(index.handleChange("file:///elsewhere/_card.html.erb", `<article></article>`)).toBe(false)
    })

    test("ignores a file that is not a template", async () => {
      const index = await analyzerFor()

      expect(index.handleChange(uriFor("app/views/posts/card.rb"), `class Card; end`)).toBe(false)
    })
  })

  describe("remove", () => {
    test("drops the partial from the index", async () => {
      const index = await analyzerFor()

      expect(index.remove(uriFor("app/views/posts/_card.html.erb"))).toBe(true)
      expect(index.partials?.lookup("posts/card", undefined)?.file).toBeUndefined()
    })

    test("says nothing changed for a file it never indexed", async () => {
      const index = await analyzerFor()

      expect(index.remove("file:///elsewhere/_card.html.erb")).toBe(false)
    })
  })

  describe("without an index", () => {
    test("stays quiet rather than throwing", async () => {
      const index = new ProjectIndex({ root: projectWith(FILES), backend: Herb })

      expect(index.partials).toBeUndefined()
      expect(index.callers).toBeUndefined()
      expect(index.handleChange(uriFor("app/views/posts/_card.html.erb"), `<article></article>`)).toBe(false)
      expect(index.remove(uriFor("app/views/posts/_card.html.erb"))).toBe(false)
    })
  })
})
