import { describe, test, expect, beforeAll, afterAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync } from "fs"
import { join } from "path"

describe("herb-highlight CLI", () => {
  const testFile = join(__dirname, "test-template.html.erb")

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

    // Should contain ANSI color codes
    expect(result).toContain("\x1b[38;2;224;108;117m<\x1b[0m") // HTML tags
    expect(result).toContain("\x1b[38;2;198;120;221mif\x1b[0m") // Ruby keywords
    expect(result).toContain("\x1b[38;2;190;80;70m<%\x1b[0m") // ERB tags

    // Should not contain corrupted ANSI codes
    expect(result).not.toContain("[38;2;209;154;102m38")
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

    // Should not contain ANSI color codes when NO_COLOR is set
    expect(result).not.toContain("\x1b[")
  })

  test("should support --focus option", () => {
    const result = execSync(`node ./bin/herb-highlight ${testFile} --focus 3`, {
      encoding: "utf8",
      cwd: process.cwd(),
    })

    // Should contain focus line indicator
    expect(result).toContain("  → ")
    // Should contain file path header
    expect(result).toContain(testFile)
    // Should contain dimmed context lines
    expect(result).toContain("\x1b[2;")
    // Should not show all lines (only focus + context)
    const lines = result.split("\n").filter((line) => line.includes("│"))
    expect(lines.length).toBeLessThanOrEqual(5) // focus + 2 context each side
  })

  test("should support --context-lines option", () => {
    const result = execSync(
      `node ./bin/herb-highlight ${testFile} --focus 3 --context-lines 1`,
      {
        encoding: "utf8",
        cwd: process.cwd(),
      },
    )

    // Should show fewer context lines
    const lines = result.split("\n").filter((line) => line.includes("│"))
    expect(lines.length).toBeLessThanOrEqual(3) // focus + 1 context each side
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
