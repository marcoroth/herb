import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { beforeAll, afterEach, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { strictLocalsDeclaration } from "@herb-tools/core"

import { buildPartialIndex } from "../src/partial-index-builder.js"
import { buildPartialCallerIndex } from "../src/partial-caller-builder.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-partial-callers-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

async function indexFor(files: Record<string, string>) {
  const root = project(files)
  const partials = await buildPartialIndex(Herb, root)

  return { callers: await buildPartialCallerIndex(Herb, root, partials), partials }
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("buildPartialCallerIndex", () => {
  test("collects the locals every call site passes", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: @post.title %>`,
      "app/views/home/show.html.erb": `<%= render "posts/card", title: "Hi", footer: true %>`,
    })

    const inferred = callers.inferSignature("app/views/posts/_card.html.erb")

    expect(inferred.locals.map(local => local.name)).toEqual(["footer", "title"])
    expect(inferred.callSiteCount).toBe(2)
    expect(inferred.keywordRest).toBe(false)
  })

  test("resolves a partial named relative to the rendering template", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "card", title: @post.title %>`,
    })

    expect(callers.inferSignature("app/views/posts/_card.html.erb").locals.map(local => local.name)).toEqual(["title"])
  })

  test("counts a dynamic partial name as unresolved and asks for keyword rest", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: "Hi" %>\n<%= render "posts/#{@kind}" %>`,
    })

    const inferred = callers.inferSignature("app/views/posts/_card.html.erb")

    expect(callers.unresolvedRenders).toBe(1)
    expect(inferred.locals.map(local => local.name)).toEqual(["title"])
    expect(inferred.keywordRest).toBe(true)
  })

  test("counts an implicit object render as unresolved", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_post.html.erb": `<h1><%= post.title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render @posts %>`,
    })

    expect(callers.unresolvedRenders).toBe(1)
  })

  test("ignores a render whose partial does not exist", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/missing" %>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb")).toEqual([])
    expect(callers.unresolvedRenders).toBe(1)
  })

  test("records a partial rendered with no locals", async () => {
    const { callers } = await indexFor({
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/posts/index.html.erb": `<%= render "shared/footer" %>`,
    })

    const inferred = callers.inferSignature("app/views/shared/_footer.html.erb")

    expect(inferred.locals).toEqual([])
    expect(inferred.callSiteCount).toBe(1)
  })

  test("finds call sites inside other partials", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/_list.html.erb": `<%= render "posts/card", title: "Nested" %>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb").map(site => site.caller)).toEqual([
      "app/views/posts/_list.html.erb",
    ])
  })

  test("reports no call sites for a partial nothing renders", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_orphan.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<h1>nothing</h1>`,
    })

    expect(callers.inferSignature("app/views/posts/_orphan.html.erb").callSiteCount).toBe(0)
  })

  test("survives a round trip through JSON", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: "Hi" %>`,
    })

    const restored = await import("@herb-tools/core").then(core => core.PartialCallerIndex.from(JSON.parse(JSON.stringify(callers))))

    expect(restored.inferSignature("app/views/posts/_card.html.erb").locals.map(local => local.name)).toEqual(["title"])
  })

  test("scans additional templates from include patterns", async () => {
    const root = project({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/legacy.rhtml": `<%= render "posts/card", author: "me" %>`,
    })

    const partials = await buildPartialIndex(Herb, root)
    const withoutInclude = await buildPartialCallerIndex(Herb, root, partials)
    const withInclude = await buildPartialCallerIndex(Herb, root, partials, { include: ["**/*.rhtml"] })

    expect(withoutInclude.inferSignature("app/views/posts/_card.html.erb").locals).toEqual([])
    expect(withInclude.inferSignature("app/views/posts/_card.html.erb").locals.map(local => local.name)).toEqual(["author"])
  })

  test("treats an excluded template as incompleteness rather than absence", async () => {
    const root = project({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: "Hi" %>`,
      "app/views/legacy/old.html.erb": `<%= render "posts/card", legacy: true %>`,
    })

    const partials = await buildPartialIndex(Herb, root)
    const callers = await buildPartialCallerIndex(Herb, root, partials, { exclude: ["app/views/legacy/**"] })

    expect(callers.skippedFiles).toBe(1)
    expect(callers.isComplete).toBe(false)
    expect(callers.inferSignature("app/views/posts/_card.html.erb").keywordRest).toBe(true)
  })

  test("is complete when nothing is skipped and every render resolves", async () => {
    const { callers } = await indexFor({
      "app/views/posts/_card.html.erb": `<h1><%= title %></h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: "Hi" %>`,
    })

    expect(callers.isComplete).toBe(true)
    expect(callers.inferSignature("app/views/posts/_card.html.erb").keywordRest).toBe(false)
  })
})

describe("strictLocalsDeclaration", () => {
  test("names every local as optional", () => {
    expect(strictLocalsDeclaration({ locals: [{ name: "title", required: false }, { name: "body", required: false }], callSiteCount: 2, keywordRest: false })).toBe(
      `<%# locals: (title: nil, body: nil) %>`,
    )
  })

  test("appends keyword rest when the caller set is incomplete", () => {
    expect(strictLocalsDeclaration({ locals: [{ name: "title", required: false }], callSiteCount: 1, keywordRest: true })).toBe(
      `<%# locals: (title: nil, **) %>`,
    )
  })

  test("produces an empty declaration when nothing was observed", () => {
    expect(strictLocalsDeclaration({ locals: [], callSiteCount: 0, keywordRest: false })).toBe(`<%# locals: () %>`)
  })

  test("renders required locals without a default", () => {
    expect(strictLocalsDeclaration({
      locals: [{ name: "title", required: true }, { name: "footer", required: false }],
      callSiteCount: 1,
      keywordRest: false,
    })).toBe(`<%# locals: (title:, footer: nil) %>`)
  })
})
