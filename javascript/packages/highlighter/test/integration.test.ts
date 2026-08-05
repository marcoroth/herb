import { describe, test, expect, beforeAll, afterAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync } from "fs"
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
    }).toThrow()
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
})
