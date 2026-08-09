import { describe, test, expect, beforeAll, afterAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("herb-highlight CLI", () => {
  const testFile = join(__dirname, "test-template.html.erb")
  const normalize = (output: string) => output.replaceAll(testFile, "<test-file>")

  beforeAll(async () => {
    await Herb.load()

    writeFileSync(
      testFile,
      `<h1 class="title">
  <% if user.present? %>
    Welcome <%= user.name %>!
  <% else %>
    Please sign in
  <% end %>
</h1>`,
    )
  })

  afterAll(() => {
    try {
      unlinkSync(testFile)
    } catch {}
  })

  test("should highlight file via CLI", () => {
    const result = execSync(`node ./bin/herb-highlight ${testFile}`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(normalize(result)).toMatchSnapshot()
  })

  test("should handle non-existent file gracefully", () => {
    expect(() => {
      execSync("node ./bin/herb-highlight non-existent-file.erb", {
        encoding: "utf8",
        cwd: process.cwd(),
      })
    }).toThrow(/File not found: non-existent-file.erb/)
  })

  test("should report the theme, not the input file, when a custom theme path is invalid", () => {
    const run = () =>
      execSync(`node ./bin/herb-highlight ${testFile} --theme not-a-theme`, {
        encoding: "utf8",
        cwd: process.cwd(),
      })

    expect(run).toThrow(/Failed to load custom theme from not-a-theme/)
    expect(run).not.toThrow(/File not found/)
  })

  test("should fall back to the default theme when --theme has no value", () => {
    const withFlag = execSync(`node ./bin/herb-highlight ${testFile} --theme`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    const withoutFlag = execSync(`node ./bin/herb-highlight ${testFile}`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(withFlag).toBe(withoutFlag)
  })

  test("should report unknown options", () => {
    expect(() => {
      execSync(`node ./bin/herb-highlight ${testFile} --bogus`, {
        encoding: "utf8",
        cwd: process.cwd(),
      })
    }).toThrow(/Unknown option: --bogus/)
  })

  test("should respect NO_COLOR environment variable", () => {
    const result = execSync(
      `NO_COLOR=1 node ./bin/herb-highlight ${testFile}`,
      {
        encoding: "utf8",
        cwd: process.cwd(),
      },
    )

    expect(result).not.toContain("\x1b[")
    expect(normalize(result)).toMatchSnapshot()
  })

  test("should support --focus option", () => {
    const result = execSync(`node ./bin/herb-highlight ${testFile} --focus 3`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(normalize(result)).toMatchSnapshot()
  })

  test("should support --context-lines option", () => {
    const result = execSync(
      `node ./bin/herb-highlight ${testFile} --focus 3 --context-lines 1`,
      {
        encoding: "utf8",
        cwd: process.cwd(),
      },
    )

    expect(normalize(result)).toMatchSnapshot()
  })

  test("should handle invalid --focus value", () => {
    expect(() => {
      execSync("node ./bin/herb-highlight test-template.html.erb --focus abc", {
        encoding: "utf8",
        cwd: process.cwd(),
      })
    }).toThrow(/Invalid focus line/)
  })

  test("should require --diagnostics for --split-diagnostics", () => {
    expect(() => {
      execSync(`node ./bin/herb-highlight ${testFile} --split-diagnostics`, {
        encoding: "utf8",
        cwd: process.cwd(),
      })
    }).toThrow(/--split-diagnostics requires --diagnostics/)
  })

  test("should render diagnostics passed as JSON", () => {
    const diagnostics = JSON.stringify([{
      message: "Test offense",
      severity: "error",
      code: "test-rule",
      location: { start: { line: 1, column: 4 }, end: { line: 1, column: 9 } },
    }])

    const result = execSync(
      `NO_COLOR=1 node ./bin/herb-highlight ${testFile} --diagnostics '${diagnostics}'`,
      { encoding: "utf8", cwd: process.cwd() },
    )

    expect(normalize(result)).toMatchSnapshot()
  })

  test("should reject diagnostics that are missing required fields", () => {
    expect(() => {
      execSync(
        `node ./bin/herb-highlight ${testFile} --diagnostics '{"message":"no location"}'`,
        { encoding: "utf8", cwd: process.cwd() },
      )
    }).toThrow(/each diagnostic must have message, location, and severity/)
  })

  test("should show the usage for --help", () => {
    const result = execSync("node ./bin/herb-highlight --help", {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(result).toMatchSnapshot()
  })

  test("should show the versions for --version", () => {
    const result = execSync("node ./bin/herb-highlight --version", {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(result.startsWith("Versions:\n")).toBe(true)
    expect(result).toContain("@herb-tools/highlighter@")
  })

  test("should require an input file", () => {
    expect(() => {
      execSync("node ./bin/herb-highlight", {
        encoding: "utf8",
        cwd: process.cwd(),
      })
    }).toThrow(/Please specify an input file/)
  })
})

describe("herb-highlight CLI diff", () => {
  let directory: string

  beforeAll(async () => {
    await Herb.load()

    directory = mkdtempSync(join(tmpdir(), "herb-highlight-"))
  })

  afterAll(() => {
    try {
      rmSync(directory, { recursive: true, force: true })
    } catch {}
  })

  test("should diff two files via the diff subcommand", () => {
    const before = join(directory, "before.html.erb")
    const after = join(directory, "after.html.erb")

    writeFileSync(before, `<div>\n  <span class='card'>x</span>\n</div>`)
    writeFileSync(after, `<div>\n  <span class="card">x</span>\n</div>`)

    const result = execSync(`NO_COLOR=1 node ./bin/herb-highlight diff ${before} ${after}`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(result.replaceAll(before, "<before>").replaceAll(after, "<after>")).toMatchSnapshot()
  })

  test("should render a diff given as JSON", () => {
    const json = JSON.stringify({ original: `<img src="a.png">`, modified: `<img src="a.png" alt="">` })

    const result = execSync(`NO_COLOR=1 node ./bin/herb-highlight diff '${json}'`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(result).toMatchSnapshot()
  })

  test("should render a unified diff given as a file", () => {
    const patch = join(directory, "fix.patch")

    writeFileSync(patch, [
      "--- a/app/views/gems/index.html.erb",
      "+++ b/app/views/gems/index.html.erb",
      "@@ -1,3 +1,3 @@",
      ` <div id="gems">`,
      `-  <span class='card'>x</span>`,
      `+  <span class="card">x</span>`,
      " </div>",
      "",
    ].join("\n"))

    const result = execSync(`NO_COLOR=1 node ./bin/herb-highlight diff ${patch}`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    expect(result).toMatchSnapshot()
  })
})
