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
  const { execSync } = require("child_process")
  const bin = resolve(process.cwd(), "bin/herb-lint")
  const command = `node ${bin} ${args.join(" ")} --no-timing --no-wrap-lines 2>&1`
  const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }

  try {
    return { output: execSync(command, { cwd, encoding: "utf-8", env }).trim(), exitCode: 0 }
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

    expect(exitCode).toBe(1)
    expect(output).toContain("Element `<style>` must be placed inside the `<head>` tag.")

    expect(output).toContain("rendered from app/views/posts/index.html.erb:2:2")
    expect(output).toContain(`<%= render "posts/card" %>`)

    expect(output).toContain("rendered into app/views/layouts/application.html.erb:7:10")
    expect(output).toContain("<main><%= yield %></main>")
  })

  test("labels every path in the output project relative", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div>\n  <style>.card {}</style>\n</div>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toContain("app/views/posts/_card.html.erb:2:2")
    expect(output).not.toContain(root)
  })

  test("names the elements each call site nests the file inside", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<section>\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div>\n  <style>.card {}</style>\n</div>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toContain("<section>")
    expect(output).toContain("<html> › <body> › <main>")
  })

  test("prints no call chain for an offense the file explains on its own", () => {
    const root = project({
      "app/views/layouts/application.html.erb": `<html>\n  <body>\n    <style>.x {}</style>\n  </body>\n</html>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toContain("Element `<style>` must be placed inside the `<head>` tag.")
    expect(output).not.toContain("rendered from")
    expect(output).not.toContain("rendered into")
  })

  test("reports the offending call site when only one call site nests the file", () => {
    const root = project({
      "app/views/layouts/application.html.erb": LAYOUT,
      "app/views/posts/index.html.erb": `<div>\n  <%= render "posts/badge" %>\n</div>\n`,
      "app/views/posts/show.html.erb": `<a href="/all">\n  <%= render "posts/badge" %>\n</a>\n`,
      "app/views/posts/_badge.html.erb": `<a href="/inner">Inner</a>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-no-nested-links")

    expect(output).toContain("At least one call site renders this file inside an `<a>` element.")
    expect(output).toContain("rendered from app/views/posts/show.html.erb:2:2")
    expect(output).not.toContain("rendered from app/views/posts/index.html.erb")
  })


  test("reports a partial rendered into both the head and the body", () => {
    const root = project({
      "app/views/layouts/application.html.erb": `<html>\n  <head>\n    <title>Site</title>\n    <%= render "posts/card" %>\n  </head>\n\n  <body>\n    <main><%= yield %></main>\n  </body>\n</html>\n`,
      "app/views/posts/index.html.erb": `<h1>Posts</h1>\n<section class="list">\n  <%= render "posts/card" %>\n</section>\n`,
      "app/views/posts/_card.html.erb": `<div class="card">\n  <style>.card { color: red }</style>\n</div>\n`,
    })

    const { output } = runLinterIn(root, "--only", "html-head-only-elements")

    expect(output).toContain("At least one call site renders this file inside the `<body>`.")

    // The chain has to name the body path, not the innocent <head> call site.
    expect(output).toContain("rendered from app/views/posts/index.html.erb:3:2")
    expect(output).not.toContain("rendered from app/views/layouts/application.html.erb:4")
  })
})
