import { describe, test, expect, beforeAll, afterEach } from "vitest"

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"

import { Herb } from "@herb-tools/node-wasm"

import { descendantVerdict } from "../src/render-graph-utils"
import { buildPartialIndex } from "../src/partial-index-builder"
import { buildRenderGraph } from "../src/render-graph-builder"

import type { RenderGraph } from "../src/render-graph"

describe("descendantVerdict", () => {
  let root: string

  beforeAll(async () => {
    await Herb.load()
  })

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  async function graphOf(files: Record<string, string>): Promise<RenderGraph> {
    root = mkdtempSync(join(tmpdir(), "herb-descendant-"))

    for (const [path, contents] of Object.entries(files)) {
      const file = join(root, path)

      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, contents, "utf-8")
    }

    const partials = await buildPartialIndex(Herb, root)

    return buildRenderGraph(Herb, root, partials, { resolveLayouts: false })
  }

  const SUMMARY = "app/views/shared/_summary.html.erb"

  test("says always when the partial always roots at the element", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details>\n  <%= render "shared/summary" %>\n  <p>Body</p>\n</details>\n`,
      [SUMMARY]: `<summary>More</summary>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("always")
  })

  test("says never when it definitely does not", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details><%= render "shared/summary" %></details>\n`,
      [SUMMARY]: `<p>Not a summary</p>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("never")
  })

  test("says mixed when the element is behind a conditional", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details><%= render "shared/summary" %></details>\n`,
      [SUMMARY]: `<% if expanded %><summary>More</summary><% end %>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("mixed")
  })

  test("follows a partial whose root is itself a render", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details><%= render "shared/summary" %></details>\n`,
      [SUMMARY]: `<%= render "shared/inner" %>\n`,
      "app/views/shared/_inner.html.erb": `<summary>More</summary>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("always")
  })

  test("says unknown when a root render cannot be resolved", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details><%= render "shared/summary" %></details>\n`,
      [SUMMARY]: `<%= render some_partial %>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("unknown")
  })

  test("says unknown when there is nothing to look at", async () => {
    const graph = await graphOf({ [SUMMARY]: `<summary>More</summary>\n` })

    expect(descendantVerdict(graph, [], "summary")).toBe("unknown")
  })

  test("survives a cycle between partials", async () => {
    const graph = await graphOf({
      [SUMMARY]: `<%= render "shared/loop" %>\n`,
      "app/views/shared/_loop.html.erb": `<%= render "shared/summary" %>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("never")
  })

  test("only counts elements at the root, not ones nested inside", async () => {
    const graph = await graphOf({
      "app/views/posts/_panel.html.erb": `<details><%= render "shared/summary" %></details>\n`,
      [SUMMARY]: `<div><summary>Buried</summary></div>\n`,
    })

    expect(descendantVerdict(graph, [SUMMARY], "summary")).toBe("never")
  })

  test("accepts any of several tag names", async () => {
    const graph = await graphOf({ [SUMMARY]: `<summary>More</summary>\n` })

    expect(descendantVerdict(graph, [SUMMARY], "figcaption", "summary")).toBe("always")
  })
})
