import dedent from "dedent"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import { generateStylesheet, resolveTheme } from "@herb-tools/highlighter"

import { REPORT_STYLESHEET } from "../src/cli/formatters/html-report-stylesheet.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-html-report-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

interface Report {
  html: string
  stderr: string
  exitCode: number
}

function reportFor(cwd: string, ...args: string[]): Report {
  const bin = resolve(process.cwd(), "bin/herb-lint")
  const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }
  const options = { cwd, encoding: "utf-8" as const, env, stdio: ["ignore", "pipe", "pipe"] as const }

  try {
    const html = execFileSync("node", [bin, "--format", "html", ...args, "--no-timing"], options)

    return { html, stderr: "", exitCode: 0 }
  } catch (error: any) {
    return {
      html: error.stdout ? error.stdout.toString() : "",
      stderr: error.stderr ? error.stderr.toString() : "",
      exitCode: error.status,
    }
  }
}

function normalize(html: string, root: string): string {
  return html
    .replaceAll(`file://${root}`, "file:///project")
    .replaceAll(root, "/project")
    .replace(/<p class="herb-report-version">Herb [^<]*<\/p>/, `<p class="herb-report-version">Herb 0.0.0</p>`)
}

function bodyOf(html: string): string {
  const start = html.indexOf("<main")
  const end = html.indexOf("</main>")

  return html.slice(start, end + "</main>".length)
}

function classesIn(stylesheet: string): Set<string> {
  const withoutBlocks = stylesheet.replace(/\{[^}]*\}/g, "")

  return new Set([...withoutBlocks.matchAll(/\.(-?[_a-zA-Z][-\w]*)/g)].map(match => match[1]))
}

const LAYOUT = dedent`
  <html>
    <head>
      <title>Site</title>
    </head>

    <body>
      <main><%= yield %></main>
    </body>
  </html>
`

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("HTML report", () => {
  test("renders a mixed verdict call chain", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<table class="posts">\n  <tr>\n    <td>\n      <form action="/search">\n        <%= render "posts/actions" %>\n      </form>\n    </td>\n  </tr>\n</table>\n`,
      "app/views/posts/show.html.erb": `<section class="post">\n  <%= render "posts/actions" %>\n</section>\n`,
      "app/views/posts/_actions.html.erb": `<form action="/posts/1" method="post">\n  <button type="submit">Delete</button>\n</form>\n`,
    })

    const { html, stderr, exitCode } = reportFor(root, "--only", "html-no-nested-forms")

    expect(exitCode).toBe(1)
    expect(stderr).toBe("")
    expect(html).toContain("invalid on <span class=\"herb-report-verdict-offending\">1</span>")
    expect(html).toContain("herb-report-frame-offending")
    expect(html).toContain("herb-report-tag-offending")
    expect(normalize(bodyOf(html), root)).toMatchSnapshot()
  })

  test("says so when the call sites could not be resolved", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render row_partial %>\n</section>\n`,
      "app/views/posts/_row.html.erb": `<div>\n  <span>Row</span>\n</div>\n`,
    })

    const { html, stderr } = reportFor(root, "--only", "erb-strict-locals-required")

    expect(stderr).toBe("")
    expect(html).toContain("call sites unknown, 1 render call in this project could not be resolved")
    expect(html).not.toContain("herb-report-chain\"")
    expect(normalize(bodyOf(html), root)).toMatchSnapshot()
  })

  test("renders the autofix diff without applying it", () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div>\n  <IMG src="/icon.png" alt="Icon">\n</div>\n`,
    })

    const { html, stderr } = reportFor(root, "--only", "html-tag-name-lowercase")

    expect(stderr).toBe("")
    expect(html).toContain("Not applied. Running <code class=\"herb-report-flag\">--fix</code> would correct this to")
    expect(html).toContain("herb-diff-inline-added")
    expect(normalize(bodyOf(html), root)).toMatchSnapshot()
  })

  test("groups the offenses of several files", () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div>\n  <IMG src="/icon.png" alt="Icon">\n</div>\n`,
      "app/views/posts/show.html.erb": `<div>\n  <SPAN>Post</SPAN>\n</div>\n`,
    })

    const { html, stderr } = reportFor(root, "--only", "html-tag-name-lowercase")

    expect(stderr).toBe("")
    expect(html.match(/class="herb-report-file"/g)).toHaveLength(2)
    expect(normalize(bodyOf(html), root)).toMatchSnapshot()
  })

  test("reports a clean run as a document of its own", () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div>\n  <img src="/icon.png" alt="Icon">\n</div>\n`,
    })

    const { html, stderr, exitCode } = reportFor(root, "--only", "html-tag-name-lowercase")

    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(html).toContain("No offenses were found.")
    expect(bodyOf(html)).not.toContain("herb-report-rail")
    expect(normalize(bodyOf(html), root)).toMatchSnapshot()
  })

  test("emits a standalone document with no external assets", () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div>\n  <IMG src="/icon.png" alt="Icon">\n</div>\n`,
    })

    const { html } = reportFor(root, "--only", "html-tag-name-lowercase")

    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html.trimEnd().endsWith("</html>")).toBe(true)
    expect(html).toContain(`<meta charset="utf-8">`)
    expect(html).toContain(`<meta name="viewport" content="width=device-width, initial-scale=1">`)
    expect(html).toContain(`<title>Herb Linter report</title>`)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/src="https?:/i)
    expect(html).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(html).not.toContain("HERB")
    expect(html).not.toContain("text-transform")
  })
})

describe("HTML report namespacing", () => {
  const chromeClasses = classesIn(REPORT_STYLESHEET)

  const fragmentStylesheet = generateStylesheet(resolveTheme("onedark"), "onedark:github-light", {
    scheme: resolveTheme("github-light"),
    label: "github-light",
  })

  const fragmentClasses = classesIn(fragmentStylesheet)

  test("names every chrome class under the report prefix", () => {
    expect(chromeClasses.size).toBeGreaterThan(0)

    for (const className of chromeClasses) {
      expect(className.startsWith("herb-report-"), `${className} is not namespaced`).toBe(true)
    }
  })

  test("shares no class with the highlighter fragment stylesheet", () => {
    expect(fragmentClasses.size).toBeGreaterThan(0)

    const shared = [...chromeClasses].filter(className => fragmentClasses.has(className))

    expect(shared).toEqual([])
  })

  test("names no class the highlighter fragments actually carry", () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div>\n  <IMG src="/icon.png" alt="Icon">\n</div>\n`,
    })

    const { html } = reportFor(root, "--only", "html-tag-name-lowercase")

    const rendered = new Set(
      [...html.matchAll(/class="([^"]+)"/g)]
        .flatMap(match => match[1].split(/\s+/))
        .filter(className => !className.startsWith("herb-report-"))
    )

    expect(rendered.size).toBeGreaterThan(0)

    const shared = [...chromeClasses].filter(className => rendered.has(className))

    expect(shared).toEqual([])
  })
})
