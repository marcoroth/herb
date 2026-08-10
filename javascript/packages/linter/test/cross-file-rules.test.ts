import dedent from "dedent"

import { beforeAll, afterEach, describe, expect, test } from "vitest"

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../src/linter.js"

import { buildPartialIndex } from "../src/partial-index-builder.js"
import { buildPartialCallerIndex } from "../src/partial-caller-builder.js"

import { A11yNestedInteractiveElementsRule } from "../src/rules/a11y-nested-interactive-elements.js"
import { A11yNoVisuallyHiddenInteractiveElementsRule } from "../src/rules/a11y-no-visually-hidden-interactive-elements.js"
import { ERBNoUnsafeRawRule } from "../src/rules/erb-no-unsafe-raw.js"
import { HTMLBodyOnlyElementsRule } from "../src/rules/html-body-only-elements.js"
import { HTMLHeadOnlyElementsRule } from "../src/rules/html-head-only-elements.js"
import { HTMLNoNestedFormsRule } from "../src/rules/html-no-nested-forms.js"
import { HTMLNoNestedLinksRule } from "../src/rules/html-no-nested-links.js"

import type { RuleClass } from "../src/types.js"

const LAYOUT = dedent`
  <html>
    <head>
      <%= render "shared/meta" %>
    </head>

    <body>
      <main><%= yield %></main>
    </body>
  </html>
`

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-cross-file-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

interface LintOptions {
  absoluteFileName?: boolean
  enabled?: boolean
}

async function lintInProject(files: Record<string, string>, ruleClass: RuleClass, target: string, options: LintOptions = {}): Promise<string[]> {
  const root = project(files)
  const partials = await buildPartialIndex(Herb, root)
  const partialCallers = await buildPartialCallerIndex(Herb, root, partials)

  const instance = new (ruleClass as any)()
  const ruleConfig = { ...instance.defaultConfig, ...(options.enabled === undefined ? {} : { enabled: options.enabled }) }
  const config = Config.fromObject({ linter: { rules: { [ruleClass.ruleName]: ruleConfig } } })
  const linter = new Linter(Herb, [ruleClass], config)

  const result = linter.lint(files[target], {
    fileName: options.absoluteFileName ? join(root, target) : target,
    partials,
    partialCallers,
    projectPath: root,
  })

  return result.offenses.filter(offense => offense.rule === ruleClass.ruleName).map(offense => offense.message)
}

async function offensesInProject(files: Record<string, string>, ruleClass: RuleClass, target: string, options: LintOptions = {}) {
  const root = project(files)
  const partials = await buildPartialIndex(Herb, root)
  const partialCallers = await buildPartialCallerIndex(Herb, root, partials)

  const instance = new (ruleClass as any)()
  const ruleConfig = { ...instance.defaultConfig, ...(options.enabled === undefined ? {} : { enabled: options.enabled }) }
  const config = Config.fromObject({ linter: { rules: { [ruleClass.ruleName]: ruleConfig } } })
  const linter = new Linter(Herb, [ruleClass], config)

  const result = linter.lint(files[target], { fileName: target, partials, partialCallers, projectPath: root })

  return result.offenses.filter(offense => offense.rule === ruleClass.ruleName)
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("a11y-no-visually-hidden-interactive-elements across files", () => {
  const partial = "app/views/shared/_control.html.erb"
  const control = `<button>Save</button>`

  test("reports a control rendered inside a visually hidden ancestor", async () => {
    const offenses = await offensesInProject({
      [partial]: control,
      "app/views/settings/show.html.erb": `<div class="sr-only"><%= render "shared/control" %></div>`,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, partial, { enabled: true })

    expect(offenses).toHaveLength(1)
    expect(offenses[0].message).toContain("Every call site renders the keyboard-focusable `<button>` element inside an ancestor hidden by `sr-only`")
    expect(offenses[0].message).toContain("The displayed call chain identifies the hidden `<div>` in `app/views/settings/show.html.erb`.")
    expect(offenses[0].renderedFrom?.frames[0].file).toBe("app/views/settings/show.html.erb")
  })

  test("reports the offending chain when only some callers are visually hidden", async () => {
    const offenses = await offensesInProject({
      [partial]: control,
      "app/views/settings/show.html.erb": `<div class="sr-only"><%= render "shared/control" %></div>`,
      "app/views/settings/edit.html.erb": `<div><%= render "shared/control" %></div>`,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, partial, { enabled: true })

    expect(offenses).toHaveLength(1)
    expect(offenses[0].message).toContain("At least one call site renders the keyboard-focusable `<button>` element inside an ancestor hidden by `sr-only`")
    expect(offenses[0].message).toContain("The displayed call chain identifies the hidden `<div>` in `app/views/settings/show.html.erb`.")
    expect(offenses[0].renderedFrom?.frames[0].file).toBe("app/views/settings/show.html.erb")
  })

  test("resolves visually hidden ancestors transitively", async () => {
    const wrapper = "app/views/shared/_wrapper.html.erb"
    const offenses = await offensesInProject({
      [partial]: control,
      [wrapper]: `<%= render "shared/control" %>`,
      "app/views/settings/show.html.erb": `<section class="sr-only"><%= render "shared/wrapper" %></section>`,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, partial, { enabled: true })

    expect(offenses).toHaveLength(1)
    expect(offenses[0].message).toContain("The displayed call chain identifies the hidden `<section>` in `app/views/settings/show.html.erb`.")
    expect(offenses[0].renderedFrom?.frames.map(frame => frame.file)).toEqual([
      "app/views/settings/show.html.erb",
      wrapper,
    ])
  })

  test("reports a control hidden by an ancestor around a layout yield", async () => {
    const view = "app/views/settings/show.html.erb"
    const offenses = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html><body><main class="sr-only"><%= yield %></main></body></html>`,
      [view]: control,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, view, { enabled: true })

    expect(offenses).toHaveLength(1)
    expect(offenses[0].message).toContain("The displayed call chain identifies the hidden `<main>` in `app/views/layouts/application.html.erb`.")
    expect(offenses[0].renderedFrom?.frames[0].via).toBe("layout")
  })

  test("passes when focus-within reveals the caller ancestor", async () => {
    const offenses = await lintInProject({
      [partial]: control,
      "app/views/settings/show.html.erb": `<div class="sr-only focus-within:not-sr-only"><%= render "shared/control" %></div>`,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, partial, { enabled: true })

    expect(offenses).toEqual([])
  })

  test("stays quiet when caller context is unknown", async () => {
    const offenses = await lintInProject({
      [partial]: control,
    }, A11yNoVisuallyHiddenInteractiveElementsRule, partial, { enabled: true })

    expect(offenses).toEqual([])
  })
})

describe("html-head-only-elements across files", () => {
  test("reports a head-only element in a partial rendered into the body", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<footer>hi</footer>\n<meta name="stray" content="x">`,
      "app/views/posts/index.html.erb": `<%= render "shared/footer" %>`,
    }, HTMLHeadOnlyElementsRule, "app/views/shared/_footer.html.erb")

    expect(offenses).toEqual(["Element `<meta>` must be placed inside the `<head>` tag."])
  })

  test("stays quiet for a partial rendered into the head", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">\n<title>Site</title>`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>`,
    }, HTMLHeadOnlyElementsRule, "app/views/shared/_meta.html.erb")

    expect(offenses).toEqual([])
  })

  test("reports a partial rendered into both, naming the body call site", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <head><%= render "shared/thing" %></head>\n  <body><%= render "shared/thing" %></body>\n</html>`,
      "app/views/shared/_thing.html.erb": `<meta charset="utf-8">`,
    }, HTMLHeadOnlyElementsRule, "app/views/shared/_thing.html.erb")

    expect(offenses).toEqual(["Element `<meta>` must be placed inside the `<head>` tag. At least one call site renders this file inside the `<body>`."])
  })

  test("resolves the same answer from an absolute file name", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/shared/_footer.html.erb": `<meta name="stray" content="x">`,
      "app/views/posts/index.html.erb": `<%= render "shared/footer" %>`,
    }, HTMLHeadOnlyElementsRule, "app/views/shared/_footer.html.erb", { absoluteFileName: true })

    expect(offenses).toEqual(["Element `<meta>` must be placed inside the `<head>` tag."])
  })
})

describe("html-body-only-elements across files", () => {
  test("reports a body-only element in a partial rendered into the head", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<div>Not allowed here</div>`,
    }, HTMLBodyOnlyElementsRule, "app/views/shared/_meta.html.erb")

    expect(offenses).toEqual(["Element `<div>` must be placed inside the `<body>` tag."])
  })
})

describe("html-no-nested-links across files", () => {
  test("reports a link in a partial rendered inside a link", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offenses).toEqual(["Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element."])
  })

  test("still reports when only one call site nests it inside a link", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/show.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offenses).toEqual(["Nested `<a>` elements are not allowed. At least one call site renders this file inside an `<a>` element."])
  })

  test("points the call chain at the offending call site, not an innocent one", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.message).toContain("At least one call site")
    expect(offense.renderedFrom!.tags).toContain("a")
    expect(offense.renderedFrom!.frames.at(-1)!.file).toBe("app/views/posts/show.html.erb")
  })
})

describe("html-no-nested-forms across files", () => {
  test("reports a form in a partial rendered inside a form", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<form action="/outer"><%= render "posts/fields" %></form>`,
      "app/views/posts/_fields.html.erb": `<form action="/inner"></form>`,
    }, HTMLNoNestedFormsRule, "app/views/posts/_fields.html.erb")

    expect(offenses).toEqual(["Nested `<form>` elements are not allowed. Every call site renders this file inside a `<form>`, so associate its controls using the `form` attribute instead."])
  })
})

describe("a11y-nested-interactive-elements across files", () => {
  test("reports an interactive element in a partial rendered inside a button", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<button><%= render "posts/badge" %></button>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, A11yNestedInteractiveElementsRule, "app/views/posts/_badge.html.erb", { enabled: true })

    expect(offenses).toEqual(["Found `<a>` nested inside of `<button>`. Every call site renders this file inside a `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls."])
  })
})

describe("erb-no-unsafe-raw across files", () => {
  test("stays quiet for a partial rendered inside a script", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<script><%= render "posts/payload" %></script>`,
      "app/views/posts/_payload.html.erb": `<%= raw(payload) %>`,
    }, ERBNoUnsafeRawRule, "app/views/posts/_payload.html.erb")

    expect(offenses).toEqual([])
  })

  test("still reports when a call site is outside a script", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<script><%= render "posts/payload" %></script>`,
      "app/views/posts/show.html.erb": `<div><%= render "posts/payload" %></div>`,
      "app/views/posts/_payload.html.erb": `<%= raw(payload) %>`,
    }, ERBNoUnsafeRawRule, "app/views/posts/_payload.html.erb")

    expect(offenses).toEqual(["Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities."])
  })
})

describe("layout yield across files", () => {
  test("reports a head-only element in a plain template through the layout yield", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>\n<title>Wrong place</title>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/index.html.erb")

    expect(offenses).toEqual(["Element `<title>` must be placed inside the `<head>` tag."])
  })

  test("carries the layout context through a template into the partial it renders", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>`,
      "app/views/posts/_card.html.erb": `<title>Wrong place</title>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/_card.html.erb")

    expect(offenses).toEqual(["Element `<title>` must be placed inside the `<head>` tag."])
  })

  test("uses a controller-specific layout over the application one", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/layouts/posts.html.erb": `<html><head><%= yield %></head><body></body></html>`,
      "app/views/posts/index.html.erb": `<div>Not allowed in head</div>`,
    }, HTMLBodyOnlyElementsRule, "app/views/posts/index.html.erb")

    expect(offenses).toEqual(["Element `<div>` must be placed inside the `<body>` tag."])
  })

  test("stays quiet for a template whose layout is missing", async () => {
    const offenses = await lintInProject({
      "app/views/posts/index.html.erb": `<title>No layout to judge this by</title>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/index.html.erb")

    expect(offenses).toEqual([])
  })

  test("stays quiet for a layout linted on its own", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
    }, HTMLHeadOnlyElementsRule, "app/views/layouts/application.html.erb")

    expect(offenses).toEqual([])
  })
})

describe("content_for across files", () => {
  test("stays quiet for a head-only element inside a content_for block", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <head><%= yield :head %></head>\n  <body><main><%= yield %></main></body>\n</html>`,
      "app/views/posts/index.html.erb": `<% content_for :head do %>\n  <title>Posts</title>\n  <meta name="robots" content="noindex">\n<% end %>\n<h1>Posts</h1>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/index.html.erb")

    expect(offenses).toEqual([])
  })

  test("stays quiet inside a content_for block in a partial too", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>`,
      "app/views/posts/_card.html.erb": `<% content_for :head do %>\n  <title>Card</title>\n<% end %>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/_card.html.erb")

    expect(offenses).toEqual([])
  })

  test("still reports a head-only element outside the content_for block", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <head><%= yield :head %></head>\n  <body><main><%= yield %></main></body>\n</html>`,
      "app/views/posts/index.html.erb": `<% content_for :head do %>\n  <title>Posts</title>\n<% end %>\n<meta name="stray" content="x">`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/index.html.erb")

    expect(offenses).toEqual(["Element `<meta>` must be placed inside the `<head>` tag."])
  })

  test("keeps reporting inside a content_for block in a whole document", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <% content_for :sidebar do %>\n      <meta name="stray" content="x">\n    <% end %>\n  </body>\n</html>`,
    }, HTMLHeadOnlyElementsRule, "app/views/layouts/application.html.erb")

    expect(offenses).toEqual(["Element `<meta>` must be placed inside the `<head>` tag."])
  })

  test("resumes judging by the call sites after the content_for block closes", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<% content_for :head do %>\n  <a href="/head">Head</a>\n<% end %>\n<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offenses).toEqual(["Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element."])
  })
})

describe("renderedFrom on the offense", () => {
  test("carries the frames that justified a cross-file offense", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<section><%= render "posts/card" %></section>`,
      "app/views/posts/_card.html.erb": `<style>.card {}</style>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/_card.html.erb")

    expect(offense.renderedFrom).toBeDefined()
    expect(offense.renderedFrom!.tags).toEqual(["html", "body", "main", "section"])
    expect(offense.renderedFrom!.frames.map(frame => [frame.file, frame.via])).toEqual([
      ["app/views/layouts/application.html.erb", "layout"],
      ["app/views/posts/index.html.erb", "render"],
    ])
    expect(offense.renderedFrom!.frames.every(frame => frame.location !== null)).toBe(true)
  })

  test("leaves renderedFrom unset for an offense decided by the file alone", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <style>.x {}</style>\n  </body>\n</html>`,
    }, HTMLHeadOnlyElementsRule, "app/views/layouts/application.html.erb")

    expect(offense.renderedFrom).toBeUndefined()
  })

  test("leaves renderedFrom unset when the local nesting explains the offense", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>`,
      "app/views/posts/_card.html.erb": `<a href="/outer"><a href="/inner">Inner</a></a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_card.html.erb")

    expect(offense.message).toContain("Links cannot contain other links")
    expect(offense.renderedFrom).toBeUndefined()
  })

  test("counts the other call sites that nest the file the same way", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>\n<%= render "posts/card" %>`,
      "app/views/posts/_card.html.erb": `<style>.card {}</style>`,
    }, HTMLHeadOnlyElementsRule, "app/views/posts/_card.html.erb")

    expect(offense.renderedFrom!.occurrences).toBe(2)
  })
})

describe("otherCallSites on the offense", () => {
  test("carries every call site the reported chain leaves out", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/edit.html.erb": `<section><%= render "posts/badge" %></section>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.otherCallSites).toHaveLength(2)
    expect(offense.otherCallSites!.map(chain => chain.tags)).toEqual([
      ["html", "body", "main", "section"],
      ["html", "body", "main", "div"],
    ])
  })

  test("leaves the chain that justified the offense out", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.renderedFrom!.tags).toEqual(["html", "body", "main", "a"])
    expect(offense.otherCallSites).not.toContainEqual(offense.renderedFrom)
    expect(offense.otherCallSites!.map(chain => chain.frames.at(-1)!.file)).toEqual(["app/views/posts/index.html.erb"])
  })

  test("carries the other call sites that are at fault too", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/edit.html.erb": `<div><a href="/edit"><%= render "posts/badge" %></a></div>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.offendingCallSites).toEqual({ offending: 2, total: 3, tags: ["a"] })
    expect(offense.otherCallSites).toHaveLength(2)
    expect(offense.otherCallSites!.filter(chain => chain.tags.includes("a"))).toHaveLength(1)
  })

  test("leaves otherCallSites unset for a file with a single call site", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.renderedFrom).toBeDefined()
    expect(offense.otherCallSites).toBeUndefined()
  })

  test("leaves otherCallSites unset for an offense decided by the file alone", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <style>.x {}</style>\n  </body>\n</html>`,
    }, HTMLHeadOnlyElementsRule, "app/views/layouts/application.html.erb")

    expect(offense.otherCallSites).toBeUndefined()
  })
})

describe("offendingCallSites on the offense", () => {
  test("counts the call sites at fault for a mixed verdict", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/edit.html.erb": `<section><%= render "posts/badge" %></section>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.offendingCallSites).toEqual({ offending: 1, total: 3, tags: ["a"] })
  })

  test("names the tags that make a call site offending", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/actions" %></div>`,
      "app/views/posts/show.html.erb": `<form action="/all"><%= render "posts/actions" %></form>`,
      "app/views/posts/_actions.html.erb": `<form action="/inner"><button>Go</button></form>`,
    }, HTMLNoNestedFormsRule, "app/views/posts/_actions.html.erb")

    expect(offense.offendingCallSites!.tags).toEqual(["form"])
  })

  test("counts every call site nesting the file the same way", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<div><%= render "posts/badge" %></div>\n<div><%= render "posts/badge" %></div>`,
      "app/views/posts/show.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.offendingCallSites).toEqual({ offending: 1, total: 3, tags: ["a"] })
  })

  test("counts the call sites of a rule that judges the whole placement", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <head><%= render "shared/thing" %></head>\n  <body><%= render "shared/thing" %></body>\n</html>`,
      "app/views/shared/_thing.html.erb": `<meta charset="utf-8">`,
    }, HTMLHeadOnlyElementsRule, "app/views/shared/_thing.html.erb")

    expect(offense.offendingCallSites).toEqual({ offending: 1, total: 2 })
  })

  test("leaves offendingCallSites unset when every call site is at fault", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>`,
      "app/views/posts/index.html.erb": `<a href="/all"><%= render "posts/badge" %></a>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offense.message).toContain("Every call site")
    expect(offense.offendingCallSites).toBeUndefined()
  })

  test("leaves offendingCallSites unset for an offense decided by the file alone", async () => {
    const [offense] = await offensesInProject({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <style>.x {}</style>\n  </body>\n</html>`,
    }, HTMLHeadOnlyElementsRule, "app/views/layouts/application.html.erb")

    expect(offense.offendingCallSites).toBeUndefined()
  })
})

describe("Action View helper call sites", () => {
  test("reports a link in a partial rendered inside a link_to block", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<%= link_to "/all" do %><%= render "posts/badge" %><% end %>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, HTMLNoNestedLinksRule, "app/views/posts/_badge.html.erb")

    expect(offenses).toEqual(["Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element."])
  })

  test("reports an interactive element rendered inside a content_tag button", async () => {
    const offenses = await lintInProject({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/shared/_meta.html.erb": `<meta charset="utf-8">`,
      "app/views/posts/index.html.erb": `<%= content_tag :button do %><%= render "posts/badge" %><% end %>`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>`,
    }, A11yNestedInteractiveElementsRule, "app/views/posts/_badge.html.erb", { enabled: true })

    expect(offenses).toEqual(["Found `<a>` nested inside of `<button>`. Every call site renders this file inside a `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls."])
  })
})
