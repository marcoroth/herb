import dedent from "dedent"

import { beforeAll, afterEach, describe, expect, test } from "vitest"

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { ancestorVerdict } from "@herb-tools/analysis"
import { buildPartialIndex } from "@herb-tools/analysis/node"
import { buildRenderGraph } from "@herb-tools/analysis/node"

import { Herb } from "@herb-tools/node-wasm"
import { RenderGraph } from "@herb-tools/analysis"

import type { AncestorChain } from "@herb-tools/analysis"

const LAYOUT = `<html>
  <head>
    <%= render "shared/meta" %>
  </head>
  <body>
    <%= render "shared/footer" %>
  </body>
</html>`

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-partial-context-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function sortedChains(chains: AncestorChain[]): string[] {
  return chains.map(chain => chain.tags.join(">")).sort()
}

function tagsOf(context: { chains: AncestorChain[] }): string[][] {
  return context.chains.map(chain => chain.tags)
}

async function indexFor(files: Record<string, string>) {
  const root = project(files)
  const partials = await buildPartialIndex(Herb, root)

  return buildRenderGraph(Herb, root, partials)
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("call site ancestors", () => {
  test("records the elements enclosing a render", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(callers.callersOf("app/views/shared/_meta.html.erb")[0].ancestors).toEqual(["html", "head"])
    expect(callers.callersOf("app/views/shared/_footer.html.erb")[0].ancestors).toEqual(["html", "body"])
  })

  test("records an empty chain for a render at the top level", async () => {
    const callers = await indexFor({
      "app/views/posts/_card.html.erb": `<h1>hi</h1>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb")[0].ancestors).toEqual([])
  })

  test("records selected static attributes on ancestors enclosing a render", async () => {
    const callers = await indexFor({
      "app/views/posts/_card.html.erb": `<h1>hi</h1>`,
      "app/views/posts/index.html.erb": `<main class="page"><div class="sr-only focus-within:not-sr-only"><%= render "posts/card" %></div></main>`,
    })

    const [callSite] = callers.callersOf("app/views/posts/_card.html.erb")

    expect(callSite.ancestors).toEqual(["main", "div"])
    expect(callSite.ancestorAttributes).toEqual([
      { class: "page" },
      { class: "sr-only focus-within:not-sr-only" },
    ])
  })

  test("carries ancestor attributes through transitive render chains", async () => {
    const callers = await indexFor({
      "app/views/shared/_control.html.erb": `<button>Save</button>`,
      "app/views/shared/_wrapper.html.erb": `<section class="wrapper"><%= render "shared/control" %></section>`,
      "app/views/posts/index.html.erb": `<main class="sr-only"><%= render "shared/wrapper" %></main>`,
    })

    const [chain] = callers.contextOf("app/views/shared/_control.html.erb").chains

    expect(chain.tags).toEqual(["main", "section"])
    expect(chain.attributes).toEqual([{ class: "sr-only" }, { class: "wrapper" }])
  })

  test("omits dynamic class values", async () => {
    const callers = await indexFor({
      "app/views/posts/_card.html.erb": `<h1>hi</h1>`,
      "app/views/posts/index.html.erb": `<main class="<%= classes %>"><%= render "posts/card" %></main>`,
    })

    const [callSite] = callers.callersOf("app/views/posts/_card.html.erb")

    expect(callSite.ancestorAttributes).toBeUndefined()
  })
})

describe("contextOf", () => {
  test("resolves a partial rendered from the layout head", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(tagsOf(callers.contextOf("app/views/shared/_meta.html.erb"))).toEqual([["html", "head"]])
    expect(callers.contextOf("app/views/shared/_meta.html.erb").resolved).toBe(true)
  })

  test("resolves transitively through an intermediate partial", async () => {
    const callers = await indexFor({
      "app/views/shared/_icon.html.erb": `<link rel="icon">`,
      "app/views/shared/_meta.html.erb": `<title>x</title><%= render "shared/icon" %>`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(tagsOf(callers.contextOf("app/views/shared/_icon.html.erb"))).toEqual([["html", "head"]])
    expect(callers.contextOf("app/views/shared/_icon.html.erb").resolved).toBe(true)
  })

  test("keeps one chain per call site when a partial is rendered from head and body", async () => {
    const callers = await indexFor({
      "app/views/shared/_thing.html.erb": `<span>hi</span>`,
      "app/views/shared/_footer.html.erb": `<footer><%= render "shared/thing" %></footer>`,
      "app/views/shared/_meta.html.erb": `<%= render "shared/thing" %>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(sortedChains(callers.contextOf("app/views/shared/_thing.html.erb").chains)).toEqual([
      "html>body>footer",
      "html>head",
    ])
  })

  test("multiplies out when an intermediate partial is itself rendered twice", async () => {
    const callers = await indexFor({
      "app/views/shared/_leaf.html.erb": `<span>hi</span>`,
      "app/views/shared/_branch.html.erb": `<%= render "shared/leaf" %>`,
      "app/views/shared/_meta.html.erb": `<%= render "shared/branch" %>`,
      "app/views/shared/_footer.html.erb": `<footer><%= render "shared/branch" %></footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(sortedChains(callers.contextOf("app/views/shared/_leaf.html.erb").chains)).toEqual([
      "html>body>footer",
      "html>head",
    ])
  })

  test("deduplicates chains that arrive by different paths", async () => {
    const callers = await indexFor({
      "app/views/shared/_leaf.html.erb": `<span>hi</span>`,
      "app/views/shared/_meta.html.erb": `<%= render "shared/leaf" %><%= render "shared/leaf" %>`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    expect(tagsOf(callers.contextOf("app/views/shared/_leaf.html.erb"))).toEqual([["html", "head"]])
  })

  test("reports an unresolved context for a partial nothing renders", async () => {
    const callers = await indexFor({
      "app/views/shared/_orphan.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<h1>hi</h1>`,
    })

    expect(callers.contextOf("app/views/shared/_orphan.html.erb")).toEqual({ chains: [], resolved: false })
  })

  test("marks the context unresolved when the chain tops out below a document root", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<div><%= render "shared/meta" %></div>`,
    })

    expect(tagsOf(callers.contextOf("app/views/shared/_meta.html.erb"))).toEqual([["div"]])
    expect(callers.contextOf("app/views/shared/_meta.html.erb").resolved).toBe(false)
  })

  test("cuts a render cycle instead of recursing forever", async () => {
    const callers = await indexFor({
      "app/views/shared/_a.html.erb": `<div><%= render "shared/b" %></div>`,
      "app/views/shared/_b.html.erb": `<section><%= render "shared/a" %></section>`,
    })

    expect(callers.contextOf("app/views/shared/_a.html.erb").resolved).toBe(false)
  })

  test("survives a round trip through JSON", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    const analysis = await import("@herb-tools/analysis")
    const restored = analysis.RenderGraph.from(JSON.parse(JSON.stringify(callers)))

    expect(tagsOf(restored.contextOf("app/views/shared/_meta.html.erb"))).toEqual([["html", "head"]])
    expect(restored.contextOf("app/views/shared/_meta.html.erb").resolved).toBe(true)
  })

  test("keeps the call site locations through a JSON round trip", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    const analysis = await import("@herb-tools/analysis")
    const restored = analysis.RenderGraph.from(JSON.parse(JSON.stringify(callers)))

    expect(restored.contextOf("app/views/shared/_meta.html.erb").chains[0].frames).toEqual([
      {
        file: "app/views/layouts/application.html.erb",
        ancestors: ["html", "head"],
        via: "render",
        location: { line: 3, column: 4 },
      },
    ])
  })
})

describe("call frames", () => {
  test("names the render call that places a partial", async () => {
    const callers = await indexFor({
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    const [chain] = callers.contextOf("app/views/shared/_footer.html.erb").chains

    expect(chain.frames).toHaveLength(1)
    expect(chain.frames[0].file).toBe("app/views/layouts/application.html.erb")
    expect(chain.frames[0].via).toBe("render")
    expect(chain.frames[0].ancestors).toEqual(["html", "body"])
    expect(chain.frames[0].location).toEqual({ line: 6, column: 4 })
  })

  test("orders frames outermost first through an intermediate partial", async () => {
    const callers = await indexFor({
      "app/views/shared/_icon.html.erb": `<link rel="icon">`,
      "app/views/shared/_meta.html.erb": `<title>x</title>\n<%= render "shared/icon" %>`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    const [chain] = callers.contextOf("app/views/shared/_icon.html.erb").chains

    expect(chain.frames.map(frame => frame.file)).toEqual([
      "app/views/layouts/application.html.erb",
      "app/views/shared/_meta.html.erb",
    ])
    expect(chain.frames.map(frame => frame.location?.line)).toEqual([3, 2])
  })

  test("marks a layout yield frame and locates it", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    const [chain] = callers.contextOf("app/views/posts/index.html.erb").chains

    expect(chain.frames).toEqual([
      {
        file: "app/views/layouts/application.html.erb",
        ancestors: ["html", "body", "main"],
        via: "layout",
        location: { line: 3, column: 10 },
      },
    ])
  })

  test("chains a layout yield frame with the render frames below it", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<section><%= render "posts/card" %></section>`,
      "app/views/posts/_card.html.erb": `<h1>Card</h1>`,
    })

    const [chain] = callers.contextOf("app/views/posts/_card.html.erb").chains

    expect(chain.tags).toEqual(["html", "body", "main", "section"])
    expect(chain.frames.map(frame => [frame.file, frame.via])).toEqual([
      ["app/views/layouts/application.html.erb", "layout"],
      ["app/views/posts/index.html.erb", "render"],
    ])
  })

  test("counts the call paths that collapse into one chain", async () => {
    const callers = await indexFor({
      "app/views/shared/_leaf.html.erb": `<span>hi</span>`,
      "app/views/shared/_meta.html.erb": `<%= render "shared/leaf" %>\n<%= render "shared/leaf" %>`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>`,
      "app/views/layouts/application.html.erb": LAYOUT,
    })

    const [chain] = callers.contextOf("app/views/shared/_leaf.html.erb").chains

    expect(chain.tags).toEqual(["html", "head"])
    expect(chain.occurrences).toBe(2)
  })

  test("leaves the location null when the call site has none", () => {
    const index = new RenderGraph(
      new Map([["app/views/shared/_a.html.erb", [{ caller: "app/views/layouts/application.html.erb", locals: [], ancestors: ["html", "body"] }]]]),
      new Map(),
      new Set(["app/views/layouts/application.html.erb"]),
      new Map(),
      new Set(),
    )

    expect(index.contextOf("app/views/shared/_a.html.erb").chains[0].frames[0]).toEqual({
      file: "app/views/layouts/application.html.erb",
      ancestors: ["html", "body"],
      via: "render",
      location: null,
    })
  })
})

describe("ancestorVerdict", () => {
  test("answers always when every chain is inside the tag", () => {
    expect(ancestorVerdict({ chains: [{ tags: ["html", "head"], frames: [], occurrences: 1 }], resolved: true }, [], "head")).toBe("always")
  })

  test("answers never when no chain is inside the tag and the context is resolved", () => {
    expect(ancestorVerdict({ chains: [{ tags: ["html", "body"], frames: [], occurrences: 1 }], resolved: true }, ["div"], "head")).toBe("never")
  })

  test("answers mixed when the call sites disagree", () => {
    expect(ancestorVerdict({ chains: [{ tags: ["html", "head"], frames: [], occurrences: 1 }, { tags: ["html", "body"], frames: [], occurrences: 1 }], resolved: true }, [], "head")).toBe("mixed")
  })

  test("answers unknown for an unresolved context that is not already inside the tag", () => {
    expect(ancestorVerdict({ chains: [{ tags: ["div"], frames: [], occurrences: 1 }], resolved: false }, [], "head")).toBe("unknown")
  })

  test("answers unknown when there are no chains at all", () => {
    expect(ancestorVerdict({ chains: [], resolved: false }, ["div"], "head")).toBe("unknown")
  })

  test("answers always from the local stack alone, whatever the callers say", () => {
    expect(ancestorVerdict({ chains: [], resolved: false }, ["svg", "head"], "head")).toBe("always")
  })

  test("answers always for an unresolved context that is already inside the tag", () => {
    expect(ancestorVerdict({ chains: [{ tags: ["html", "body"], frames: [], occurrences: 1 }], resolved: false }, [], "body")).toBe("always")
  })
})

describe("layout resolution", () => {
  const APPLICATION = dedent`
    <html>
      <head><title>Site</title></head>
      <body>
        <main><%= yield %></main>
      </body>
    </html>
    `

  test("gives a template the ancestors of its layout's yield", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/posts/index.html.erb"))).toEqual([["html", "body", "main"]])
    expect(callers.contextOf("app/views/posts/index.html.erb").resolved).toBe(true)
  })

  test("marks the inferred call site as coming from a layout", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(callers.callersOf("app/views/posts/index.html.erb")).toEqual([
      {
        caller: "app/views/layouts/application.html.erb",
        locals: [],
        ancestors: ["html", "body", "main"],
        via: "layout",
        location: { line: 4, column: 10 },
      },
    ])
  })

  test("carries the layout context through to a partial the template renders", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>`,
      "app/views/posts/_card.html.erb": `<h1>Card</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/posts/_card.html.erb"))).toEqual([["html", "body", "main"]])
    expect(callers.contextOf("app/views/posts/_card.html.erb").resolved).toBe(true)
  })

  test("prefers a controller-specific layout over application", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/layouts/posts.html.erb": `<html><body><section><%= yield %></section></body></html>`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/posts/index.html.erb"))).toEqual([["html", "body", "section"]])
  })

  test("walks up to a parent namespace layout", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/layouts/admin.html.erb": `<html><body><aside><%= yield %></aside></body></html>`,
      "app/views/admin/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/admin/posts/index.html.erb"))).toEqual([["html", "body", "aside"]])
  })

  test("sends mailer views to the mailer layout rather than application", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/layouts/mailer.html.erb": `<html><body><table><%= yield %></table></body></html>`,
      "app/views/user_mailer/welcome.html.erb": `<h1>Welcome</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/user_mailer/welcome.html.erb"))).toEqual([["html", "body", "table"]])
  })

  test("ignores a named yield", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": `<html><head><%= yield :head %></head><body><main><%= yield %></main></body></html>`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(tagsOf(callers.contextOf("app/views/posts/index.html.erb"))).toEqual([["html", "body", "main"]])
  })

  test("leaves partials without a layout call site", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/posts/_card.html.erb": `<h1>Card</h1>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb")).toEqual([])
  })

  test("leaves layouts themselves without a layout call site", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": APPLICATION,
    })

    expect(callers.callersOf("app/views/layouts/application.html.erb")).toEqual([])
  })

  test("records one chain per yield when a layout yields twice", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": `<html><body><header><%= yield %></header><main><%= yield %></main></body></html>`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    expect(sortedChains(callers.contextOf("app/views/posts/index.html.erb").chains)).toEqual([
      "html>body>header",
      "html>body>main",
    ])
  })

  test("stays out of the way when layout resolution is turned off", async () => {
    const root = project({
      "app/views/layouts/application.html.erb": APPLICATION,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    })

    const partials = await buildPartialIndex(Herb, root)
    const callers = await buildRenderGraph(Herb, root, partials, { resolveLayouts: false })

    expect(callers.callersOf("app/views/posts/index.html.erb")).toEqual([])
  })
})

describe("Action View helper ancestors", () => {
  test("records a content_tag block as an ancestor", async () => {
    const callers = await indexFor({
      "app/views/posts/_card.html.erb": `<h1>hi</h1>`,
      "app/views/posts/index.html.erb": `<%= content_tag :section do %><%= render "posts/card" %><% end %>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb")[0].ancestors).toEqual(["section"])
  })

  test("records a tag.div block as an ancestor", async () => {
    const callers = await indexFor({
      "app/views/posts/_card.html.erb": `<h1>hi</h1>`,
      "app/views/posts/index.html.erb": `<%= tag.div do %><%= render "posts/card" %><% end %>`,
    })

    expect(callers.callersOf("app/views/posts/_card.html.erb")[0].ancestors).toEqual(["div"])
  })

  test("records a link_to block as an anchor ancestor", async () => {
    const callers = await indexFor({
      "app/views/posts/_badge.html.erb": `<span>hi</span>`,
      "app/views/posts/index.html.erb": `<%= link_to "/x" do %><%= render "posts/badge" %><% end %>`,
    })

    expect(callers.callersOf("app/views/posts/_badge.html.erb")[0].ancestors).toEqual(["a"])
  })

  test("resolves a helper ancestor through the layout too", async () => {
    const callers = await indexFor({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<%= link_to "/x" do %><%= render "posts/badge" %><% end %>`,
      "app/views/posts/_badge.html.erb": `<span>hi</span>`,
    })

    expect(tagsOf(callers.contextOf("app/views/posts/_badge.html.erb"))).toEqual([["html", "body", "main", "a"]])
  })
})
