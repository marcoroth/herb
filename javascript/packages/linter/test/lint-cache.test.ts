import dedent from "dedent"

import { afterEach, describe, expect, test } from "vitest"

import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const BIN = resolve(__dirname, "../bin/herb-lint")

const CONFIG = dedent`
  version: 0.11.2
  framework: actionview
`

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-lint-cache-"))

  projects.push(root)
  write(root, { ".herb.yml": CONFIG, ...files })

  return root
}

function write(root: string, files: Record<string, string>): void {
  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }
}

interface JSONOffense {
  filename: string
  message: string
  code: string
}

function run(root: string, ...args: string[]): string {
  return spawnSync(BIN, ["--no-timing", "--jobs", "1", ...args], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }
  }).stdout
}

function lint(root: string, ...args: string[]): { offenses: JSONOffense[], output: string } {
  const output = run(root, "--json", ...args)

  return { offenses: JSON.parse(output).offenses, output }
}

/**
 * Linting a whole project reports absolute paths, which on macOS go through the
 * `/private` symlink, so offenses are matched by their project-relative suffix.
 */
function offensesFor(offenses: JSONOffense[], filename: string): JSONOffense[] {
  return offenses.filter(offense => offense.filename.endsWith(`/${filename}`))
}

function codesFor(offenses: JSONOffense[], filename: string): string[] {
  return offensesFor(offenses, filename).map(offense => offense.code).sort()
}

function cachePath(root: string): string {
  return join(root, "tmp/cache/herb-lint/lint-cache.json")
}

/**
 * Rewrites every cached message for a file, so a later run that prints the
 * rewritten message proves the result came from the cache.
 */
function tamperWithCache(root: string, filename: string): void {
  const cache = JSON.parse(readFileSync(cachePath(root), "utf-8"))

  for (const cached of cache.files[filename].offenses) {
    cached.offense.message = "from the cache"
  }

  writeFileSync(cachePath(root), JSON.stringify(cache), "utf-8")
}

function messagesFor(offenses: JSONOffense[], filename: string): string[] {
  return offensesFor(offenses, filename).map(offense => offense.message)
}

afterEach(() => {
  for (const root of projects.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("--cache", () => {
  test("writes the cache to tmp/cache/herb-lint when the project has no node_modules", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache")

    expect(existsSync(cachePath(root))).toBe(true)
  })

  test("writes the cache to node_modules/.cache/herb-lint when the project has node_modules", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n`, "node_modules/.keep": "" })

    lint(root, "--cache")

    expect(existsSync(join(root, "node_modules/.cache/herb-lint/lint-cache.json"))).toBe(true)
    expect(existsSync(cachePath(root))).toBe(false)
  })

  test("writes the cache to --cache-location, inside it when it names a directory", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache-location", "custom/lint.json")
    lint(root, "--cache-location", "other/")

    expect(existsSync(join(root, "custom/lint.json"))).toBe(true)
    expect(existsSync(join(root, "other/lint-cache.json"))).toBe(true)
  })

  test("reports the same offenses from the cache as from a fresh lint", () => {
    const root = project({
      "app/views/pages/show.html.erb": `<img src="a.png">\n`,
      "app/views/pages/index.html.erb": `<div>fine</div>\n`
    })

    const fresh = lint(root)
    lint(root, "--cache")
    const cached = lint(root, "--cache")

    expect(cached.output).toEqual(fresh.output)
    expect(codesFor(cached.offenses, "app/views/pages/show.html.erb")).toEqual(["html-img-require-alt"])
  })

  test("reads an unchanged file's result from the cache", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache")
    tamperWithCache(root, "app/views/pages/show.html.erb")

    expect(messagesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual(["from the cache"])
  })

  test("lints a file again when its content changes", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache")
    write(root, { "app/views/pages/show.html.erb": `<img src="a.png" alt="">\n` })

    expect(lint(root, "--cache").offenses).toEqual([])
  })

  test("lints every file again when .herb.yml changes", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache")
    write(root, { ".herb.yml": `${CONFIG}\nlinter:\n  rules:\n    html-img-require-alt:\n      enabled: false\n` })

    expect(lint(root, "--cache").offenses).toEqual([])
  })

  test("lints every file again when the rule selection changes", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    lint(root, "--cache")

    expect(lint(root, "--cache", "--only", "html-tag-name-lowercase").offenses).toEqual([])
    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual(["html-img-require-alt"])
  })

  test("lints a caller again when a partial it renders changes its locals", () => {
    const root = project({
      "app/views/shared/_card.html.erb": `<%# locals: (title:) -%>\n<h2><%= title %></h2>\n`,
      "app/views/pages/show.html.erb": `<%= render "shared/card", title: "Hello" %>\n`
    })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual([])

    write(root, { "app/views/shared/_card.html.erb": `<%# locals: (heading:) -%>\n<h2><%= heading %></h2>\n` })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).not.toEqual([])
  })

  test("lints a partial again when a caller changes where it renders it", () => {
    const root = project({
      "app/views/shared/_link.html.erb": `<a href="/inner">Inner</a>\n`,
      "app/views/pages/show.html.erb": `<div><%= render "shared/link" %></div>\n`
    })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/shared/_link.html.erb")).toEqual([])

    write(root, { "app/views/pages/show.html.erb": `<a href="/outer"><%= render "shared/link" %></a>\n` })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/shared/_link.html.erb")).toContain("html-no-nested-links")
  })

  test("keeps a partial's cached result when an unrelated template changes", () => {
    const root = project({
      "app/views/shared/_link.html.erb": `<img src="a.png">\n`,
      "app/views/pages/show.html.erb": `<div><%= render "shared/link" %></div>\n`,
      "app/views/pages/index.html.erb": `<p>unrelated</p>\n`
    })

    lint(root, "--cache")
    tamperWithCache(root, "app/views/shared/_link.html.erb")
    write(root, { "app/views/pages/index.html.erb": `\n<p>unrelated, one line lower</p>\n` })

    expect(messagesFor(lint(root, "--cache").offenses, "app/views/shared/_link.html.erb")).toEqual(["from the cache"])
  })

  test("lints every file again when a custom rule changes", () => {
    const rule = (word: string) => dedent`
      export default class NoWordRule {
        static ruleName = "no-word"

        check(document) {
          if (!(document.source || "").includes("${word}")) return []

          return [{ message: "Found ${word}", location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } }]
        }
      }
    `

    const root = project({
      ".herb/rules/no-word.mjs": rule("hello"),
      "app/views/pages/show.html.erb": `<div>goodbye</div>\n`
    })

    expect(run(root, "--simple", "--cache")).not.toContain("Found goodbye")

    write(root, { ".herb/rules/no-word.mjs": rule("goodbye") })

    expect(run(root, "--simple", "--cache")).toContain("Found goodbye")
  })

  test("lints every file again when a hidden file under .herb/rules changes", () => {
    const root = project({
      ".herb/rules/.word.json": `{ "word": "hello" }`,
      ".herb/rules/no-word.mjs": dedent`
        import { readFileSync } from "node:fs"

        export default class NoWordRule {
          static ruleName = "no-word"

          check(document) {
            const { word } = JSON.parse(readFileSync(new URL("./.word.json", import.meta.url), "utf-8"))

            if (!(document.source || "").includes(word)) return []

            return [{ message: \`Found \${word}\`, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } }]
          }
        }
      `,
      "app/views/pages/show.html.erb": `<div>goodbye</div>\n`
    })

    expect(run(root, "--simple", "--cache")).not.toContain("Found goodbye")

    write(root, { ".herb/rules/.word.json": `{ "word": "goodbye" }` })

    expect(run(root, "--simple", "--cache")).toContain("Found goodbye")
  })

  test("still fixes a cached file under --fix", () => {
    const root = project({ "app/views/pages/show.html.erb": `<DIV>shout</DIV>\n` })

    lint(root, "--cache")
    lint(root, "--cache", "--fix")

    expect(readFileSync(join(root, "app/views/pages/show.html.erb"), "utf-8")).toEqual(`<div>shout</div>\n`)
    expect(lint(root, "--cache").offenses).toEqual([])
  })

  test("starts over from a cache file it cannot read", () => {
    const root = project({ "app/views/pages/show.html.erb": `<img src="a.png">\n` })

    write(root, { "tmp/cache/herb-lint/lint-cache.json": `{"format": 1, "key": ` })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual(["html-img-require-alt"])
    expect(JSON.parse(readFileSync(cachePath(root), "utf-8")).files).toHaveProperty(["app/views/pages/show.html.erb"])
  })

  test("drops entries for files that no longer exist", () => {
    const root = project({
      "app/views/pages/show.html.erb": `<img src="a.png">\n`,
      "app/views/pages/gone.html.erb": `<img src="b.png">\n`
    })

    lint(root, "--cache")
    rmSync(join(root, "app/views/pages/gone.html.erb"))
    lint(root, "--cache")

    expect(Object.keys(JSON.parse(readFileSync(cachePath(root), "utf-8")).files)).toEqual(["app/views/pages/show.html.erb"])
  })

  test("lints every file again when template_engine changes", () => {
    const root = project({
      ".herb.yml": `${CONFIG}\ntemplate_engine: herb\n`,
      "app/views/pages/show.html.erb": `<%= foo # comment %>\n`
    })

    const severity = () => lint(root, "--cache").output.match(/"severity": "(\w+)"/)![1]

    expect(severity()).toEqual("warning")

    write(root, { ".herb.yml": `${CONFIG}\ntemplate_engine: erubi\n` })

    expect(severity()).toEqual("error")
  })

  test("reads the cache restored into a checkout at another path", () => {
    const files = { "app/views/pages/show.html.erb": `<img src="a.png">\n` }
    const first = project(files)
    const second = project(files)

    lint(first, "--cache")
    tamperWithCache(first, "app/views/pages/show.html.erb")
    write(second, { "tmp/cache/herb-lint/lint-cache.json": readFileSync(cachePath(first), "utf-8") })

    expect(messagesFor(lint(second, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual(["from the cache"])
  })

  test("reports the same offenses in the same order with workers", () => {
    const files: Record<string, string> = {}

    for (let index = 0; index < 12; index++) {
      files[`app/views/pages/page_${String(index).padStart(2, "0")}.html.erb`] = `<img src="${index}.png">\n<DIV>${index}</DIV>\n`
    }

    const root = project(files)
    const serial = lint(root, "--jobs", "1").output

    expect(lint(root, "--jobs", "2").output).toEqual(serial)
    expect(lint(root, "--jobs", "2", "--cache").output).toEqual(serial)
    expect(Object.keys(JSON.parse(readFileSync(cachePath(root), "utf-8")).files)).toHaveLength(12)
    expect(lint(root, "--jobs", "2", "--cache").output).toEqual(serial)
  })

  test("does not save the cache from a --fix run that fixed something", () => {
    const files: Record<string, string> = {}

    for (let index = 0; index < 12; index++) {
      files[`app/views/pages/page_${String(index).padStart(2, "0")}.html.erb`] = `<div>${index}</div>\n`
    }

    const root = project({ ...files, "app/views/pages/page_05.html.erb": `<DIV>shout</DIV>\n` })

    lint(root, "--jobs", "2", "--cache", "--fix")

    expect(existsSync(cachePath(root))).toBe(false)

    lint(root, "--jobs", "2", "--cache", "--fix")

    expect(Object.keys(JSON.parse(readFileSync(cachePath(root), "utf-8")).files)).toHaveLength(12)
  })

  test("reports a fresh result after a --fix run is undone", () => {
    const original = `<% # locals: (title:) %>\n<h2><%= title %></h2>\n`
    const root = project({
      "app/views/application/_card.html.erb": original,
      "app/views/pages/show.html.erb": `<%= render "application/card" %>\n`
    })

    lint(root, "app/views", "--cache", "--fix")
    write(root, { "app/views/application/_card.html.erb": original })

    expect(lint(root, "app/views", "--cache").output).toEqual(lint(root, "app/views").output)
  })

  test("lints every file again when the config comes from another directory", () => {
    const config = `${CONFIG}\nlinter:\n  rules:\n    html-img-require-alt:\n      exclude:\n        - "show.html.erb"\n`
    const root = project({
      ".herb.yml": config,
      "app/views/pages/.herb.yml": config,
      "app/views/pages/show.html.erb": `<img src="a.png">\n`
    })

    const fromRoot = codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")
    const fromPages = codesFor(lint(root, "--cache", "--config-file", "app/views/pages/.herb.yml").offenses, "app/views/pages/show.html.erb")

    expect(fromPages).toEqual(codesFor(lint(root, "--config-file", "app/views/pages/.herb.yml").offenses, "app/views/pages/show.html.erb"))
    expect(fromRoot).toEqual(codesFor(lint(root).offenses, "app/views/pages/show.html.erb"))
  })

  test("lints cached callers again when --fix changes a partial's locals", () => {
    const root = project({
      "app/views/shared/_card.html.erb": `<% # locals: (title:) %>\n<h2><%= title %></h2>\n`,
      "app/views/pages/show.html.erb": `<%= render "shared/card" %>\n`
    })

    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual([])

    const fixed = lint(root, "--cache", "--fix")

    expect(readFileSync(join(root, "app/views/shared/_card.html.erb"), "utf-8")).not.toContain("<% #")
    expect(codesFor(fixed.offenses, "app/views/pages/show.html.erb")).toEqual(["actionview-no-strict-locals-error"])
    expect(codesFor(lint(root, "--cache").offenses, "app/views/pages/show.html.erb")).toEqual(["actionview-no-strict-locals-error"])
  })
})
