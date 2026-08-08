import dedent from "dedent"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-cli-chain-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function runLinterIn(cwd: string, ...args: string[]): { output: string, exitCode: number } {
  const { execFileSync } = require("child_process")
  const bin = resolve(process.cwd(), "bin/herb-lint")
  const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }
  const options = { cwd, encoding: "utf-8" as const, env, stdio: ["ignore", "pipe", "pipe"] as const }

  try {
    return { output: execFileSync("node", [bin, ...args, "--no-timing", "--no-wrap-lines"], options).trim(), exitCode: 0 }
  } catch (error: any) {
    const stdout = error.stdout ? error.stdout.toString().trim() : ""
    const stderr = error.stderr ? error.stderr.toString().trim() : ""

    return { output: (stdout + "\n" + stderr).trim(), exitCode: error.status }
  }
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

describe("CLI call chain output", () => {
  test("prints the call chain under a cross-file offense", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section class="list">\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div class="card">\n  <style>.card { color: red }</style>\n</div>\n`,
    })

    const { output, exitCode } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("labels every path in the output project relative", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div>\n  <style>.card {}</style>\n</div>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toMatchSnapshot()
    expect(output).not.toContain(root)
  })

  test("prints no call chain for an offense the file explains on its own", () => {
    const root = project({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <style>.x {}</style>\n  </body>\n</html>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toMatchSnapshot()
  })

  test("reports the offending call site when only one call site nests the file", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<div>\n  <%= render "posts/badge" %>\n</div>\n`,
      "app/views/posts/show.html.erb": `<a href="/all">\n  <%= render "posts/badge" %>\n</a>\n`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-no-nested-links")

    expect(output).toMatchSnapshot()
    expect(output).not.toContain("rendered from app/views/posts/index.html.erb")
  })

  test("reports a partial rendered into both the head and the body", () => {
    const root = project({
      "app/views/layouts/application.html.erb": `<html>\n  <head>\n    <title>Site</title>\n    <%= render "posts/card" %>\n  </head>\n\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>\n<section class="list">\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div class="card">\n  <style>.card { color: red }</style>\n</div>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toMatchSnapshot()
    expect(output).not.toContain("rendered from app/views/layouts/application.html.erb:4")
  })

  test("points a missing strict local at the declaration it violates", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>\n\n<section class="list">\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<%# locals: (title:) %>\n<h2><%= title %></h2>\n`,
    })

    const { output } = runLinterIn(root, "--only", "actionview-no-strict-locals-error")

    expect(output).toMatchSnapshot()
    expect(output).not.toContain("rendered into")
  })

  test("points an undeclared strict local at the declaration too", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<%= render "posts/card", title: "Hi", extra: true %>\n`,
      "app/views/posts/_card.html.erb": `<%# locals: (title:) %>\n<h2><%= title %></h2>\n`,
    })

    const { output } = runLinterIn(root, "--only", "actionview-no-strict-locals-error")

    expect(output).toMatchSnapshot()
  })

  test("prints no frame for a partial without a strict locals declaration", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<%= render "posts/card" %>\n`,
      "app/views/posts/_card.html.erb": `<h2>Card</h2>\n`,
    })

    const { output } = runLinterIn(root, "--only", "actionview-no-strict-locals-error")

    expect(output).toMatchSnapshot()
  })
})
