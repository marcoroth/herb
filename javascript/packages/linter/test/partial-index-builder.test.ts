import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { beforeAll, afterEach, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { buildPartialIndex, findViewRoot, refreshPartialAfterFix } from "../src/partial-index-builder.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-partial-index-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("buildPartialIndex", () => {
  test("prefers the base template over every variant", async () => {
    const root = project({
      "app/views/users/_card.en.html.erb": `<%# locals: (locale_variant:) %>\n`,
      "app/views/users/_card.html+phone.erb": `<%# locals: (phone_variant:) %>\n`,
      "app/views/users/_card.json.erb": `<%# locals: (json_variant:) %>\n`,
      "app/views/users/_card.turbo_stream.erb": `<%# locals: (turbo_variant:) %>\n`,
      "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toEqual([{ name: "user", required: true }])
  })

  test("falls back to a variant when there is no base template", async () => {
    const root = project({
      "app/views/users/_card.html+phone.erb": `<%# locals: (user:) %>\n`,
      "app/views/users/_card.en.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.en.html.erb")
  })

  test("prefers html over turbo_stream when both are base templates", async () => {
    const root = project({
      "app/views/users/_card.turbo_stream.erb": `<%# locals: (turbo:) %>\n`,
      "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("indexes the partials of a Rails project", async () => {
    const root = project({
      "app/views/users/_card.html.erb": `<%# locals: (user:, size: "large") %>\n\n<%= user %>\n`,
      "app/views/application/_flash.html.erb": `<%# locals: (message:) %>\n\n<%= message %>\n`,
      "app/views/posts/index.html.erb": `<%= render "users/card", user: @user %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.viewRoot).toBe("app/views")
    expect(index.size).toBe(2)

    expect(index.lookup("users/card", "app/views/posts/index.html.erb")).toEqual({
      file: "app/views/users/_card.html.erb",
      hasDeclaration: true,
      hasKeywordRest: false,
      locals: [{ name: "user", required: true }, { name: "size", required: false }],
    })
  })

  test("does not index templates that are not partials", async () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div></div>\n`,
      "app/views/posts/_row.html.erb": `<%# locals: (post:) %>\n\n<%= post %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("posts/row", "app/views/posts/index.html.erb")).not.toBeNull()
  })

  test("indexes every partial extension", async () => {
    const root = project({
      "app/views/posts/_row.turbo_stream.erb": `<%# locals: (post:) %>\n`,
      "app/views/posts/_cell.herb": `<%# locals: (cell:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(2)
  })

  test("falls back to the project root when there is no app/views", async () => {
    const root = project({
      "views/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.viewRoot).toBe(".")
    expect(index.lookup("views/card", "index.html.erb")?.file).toBe("views/_card.html.erb")
  })

  test("indexes a partial that mentions locals in prose", async () => {
    const root = project({
      "app/views/posts/_row.html.erb": `<%# renders one row, no locals declared %>\n<div>Row</div>\n`,
      "app/views/posts/_cell.html.erb": `<%# locals: (cell:) %>\n\n<%= cell %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("posts/row", "app/views/posts/index.html.erb")?.hasDeclaration).toBe(false)
    expect(index.lookup("posts/cell", "app/views/posts/index.html.erb")?.locals).toEqual([{ name: "cell", required: true }])
  })

  test("records a partial without a declaration", async () => {
    const root = project({
      "app/views/posts/_row.html.erb": `<div>Row</div>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("posts/row", "app/views/posts/index.html.erb")?.hasDeclaration).toBe(false)
  })

  test("returns an empty index for a project with no partials", async () => {
    const root = project({ "app/views/posts/index.html.erb": `<div></div>\n` })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(0)
  })
})

describe("findViewRoot", () => {
  test("prefers app/views when it holds partials", async () => {
    const root = project({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(await findViewRoot(root)).toBe("app/views")
  })

  test("falls back to the project root", async () => {
    const root = project({ "templates/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(await findViewRoot(root)).toBe(".")
  })
})

describe("refreshPartialAfterFix", () => {
  const WITHOUT = `<h1><%= title %></h1>\n`
  const WITH = `<%# locals: (title:) %>\n<h1><%= title %></h1>\n`

  test("updates the index when a fix adds a strict locals declaration", async () => {
    const root = project({ "app/views/posts/_card.html.erb": WITHOUT })
    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("posts/card", "app/views/posts/index.html.erb")?.hasDeclaration).toBe(false)

    const changed = refreshPartialAfterFix(Herb, index, "app/views/posts/_card.html.erb", WITHOUT, WITH)

    expect(changed).toBe(true)

    const declaration = index.lookup("posts/card", "app/views/posts/index.html.erb")

    expect(declaration?.hasDeclaration).toBe(true)
    expect(declaration?.locals.map(local => local.name)).toEqual(["title"])
  })

  test("reports no change when the declaration is untouched", async () => {
    const root = project({ "app/views/posts/_card.html.erb": WITH })
    const index = await buildPartialIndex(Herb, root)

    const reformatted = `<%# locals: (title:) %>\n<h1><%= title %></h1>\n<p>extra</p>\n`

    expect(refreshPartialAfterFix(Herb, index, "app/views/posts/_card.html.erb", WITH, reformatted)).toBe(false)
  })

  test("ignores files that are not partials", async () => {
    const root = project({ "app/views/posts/_card.html.erb": WITH })
    const index = await buildPartialIndex(Herb, root)

    expect(refreshPartialAfterFix(Herb, index, "app/views/posts/index.html.erb", WITHOUT, WITH)).toBe(false)
  })

  test("is a no-op without an index", () => {
    expect(refreshPartialAfterFix(Herb, undefined, "app/views/posts/_card.html.erb", WITHOUT, WITH)).toBe(false)
  })
})
