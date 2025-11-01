import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import dedent from "dedent"

describe("CLI Output Formatting", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function runLinter(fixture: string, ...args: (string | Record<string, string>)[]): { output: string, exitCode: number } {
    try {
      const { execSync } = require("child_process")
      let env: Record<string, string> = {}

      if (typeof args[args.length - 1] === "object") {
        env = args.pop() as Record<string, string>
      }

      const allArgs = [...(args as string[]), "--no-timing"].join(' ')

      const output = execSync(`bin/herb-lint test/fixtures/${fixture} ${allArgs} 2>&1`, {
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined, ...env }
      })

      return { output: output.trim(), exitCode: 0 }
    } catch (error: any) {
      const stderr = error.stderr ? error.stderr.toString().trim() : ""
      const stdout = error.stdout ? error.stdout.toString().trim() : ""
      const combined = (stdout + "\n" + stderr).trim()

      return { output: combined || stderr || stdout, exitCode: error.status }
    }
  }

  test("formats detailed error output correctly", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats simple output correctly", () => {
    const { output, exitCode } = runLinter("test-file-simple.html.erb", "--simple", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats simple output for bad-file correctly", () => {
    const { output, exitCode } = runLinter("bad-file.html.erb", "--simple", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("handles boolean attributes", () => {
    const { output, exitCode } = runLinter("boolean-attribute.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(0)
  })

  test("formats success output correctly", () => {
    const { output, exitCode } = runLinter("clean-file.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(0)
  })

  test("handles multiple errors correctly", () => {
    const { output, exitCode } = runLinter("bad-file.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("displays most violated rules with multiple offenses", () => {
    const { output, exitCode } = runLinter("multiple-rule-offenses.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("displays rule offenses when showing all rules", () => {
    const { output, exitCode } = runLinter("few-rule-offenses.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("diplays only parsers errors if one is present", () => {
    const { output, exitCode } = runLinter("parser-errors.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("enables line wrapping by default", () => {
    const { output } = runLinter("long-line.html.erb")

    expect(output).toContain("        │")

    const lines = output.split('\n')
    const wrappedLines = lines.filter(line => line.match(/^\s+│\s/))
    expect(wrappedLines.length).toBeGreaterThan(0)
  })

  test("correctly passes filename context for file-specific rules", () => {
    const { output, exitCode } = runLinter("no-trailing-newline.html.erb", "--simple", "--no-wrap-lines")

    expect(output).toContain("erb-require-trailing-newline")
    expect(output).toContain("File must end with trailing newline")
    expect(exitCode).toBe(1)
  })

  test("formats JSON output correctly for file with errors", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--json")

    const json = JSON.parse(output)
    expect(json).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats JSON output correctly for clean file", () => {
    const { output, exitCode } = runLinter("clean-file.html.erb", "--json")

    const json = JSON.parse(output)
    expect(json).toMatchSnapshot()
    expect(exitCode).toBe(0)
  })

  test("formats JSON output correctly for bad file", () => {
    const { output, exitCode } = runLinter("bad-file.html.erb", "--json")

    const json = JSON.parse(output)
    expect(json).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats GitHub Actions output correctly for file with errors", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats GitHub Actions output correctly for clean file", () => {
    const { output, exitCode } = runLinter("clean-file.html.erb", "--github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(0)
  })

  test("formats GitHub Actions output correctly for bad file", () => {
    const { output, exitCode } = runLinter("bad-file.html.erb", "--github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats GitHub Actions output with --format=github option", () => {
    const { output, exitCode } = runLinter("test-file-simple.html.erb", "--format=github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("uses GitHub Actions format by default when GITHUB_ACTIONS is true", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", { GITHUB_ACTIONS: "true" })

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("GitHub Actions format escapes special characters in messages", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("GitHub Actions format includes rule codes", () => {
    const { output, exitCode } = runLinter("no-trailing-newline.html.erb", "--github")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("GitHub Actions format includes rule codes", () => {
    const { output, exitCode } = runLinter("erb-no-extra-whitespace-inside-tags.html.erb")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("Ignores disabled rules", () => {
    const { output, exitCode } = runLinter("ignored.html.erb")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("herb:disable rules", () => {
    const result1 = runLinter("disabled-1.html.erb")
    expect(result1.output).toMatchSnapshot()
    expect(result1.exitCode).toBe(1)

    const result2 = runLinter("disabled-2.html.erb")
    expect(result2.output).toMatchSnapshot()
    expect(result2.exitCode).toBe(1)
  })

  test("--ignore-disable-comments", () => {
    const { output, exitCode } = runLinter("ignored.html.erb", "--ignore-disable-comments")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("rejects --github with --json format", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--json", "--github")

    expect(output).toBe("Error: --github cannot be used with --json format. JSON format is already structured for programmatic consumption.")
    expect(exitCode).toBe(1)
  })

  test("rejects --github with --format=json", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--format=json", "--github")

    expect(output).toBe("Error: --github cannot be used with --json format. JSON format is already structured for programmatic consumption.")
    expect(exitCode).toBe(1)
  })

  test("--no-github disables GitHub Actions annotations", () => {
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--no-github", { GITHUB_ACTIONS: "true" })

    expect(output).not.toMatch(/^::error/)
    expect(output).toMatch(/error.*Missing required.*alt.*attribute/)
    expect(exitCode) .toBe(1)
  })

  describe("Excluded Files", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    test("warns and skips excluded file without --force", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            exclude:
              - "test-file-with-errors.html.erb"
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb")

        expect(output).toContain("File test/fixtures/test-file-with-errors.html.erb is excluded by configuration patterns")
        expect(output).toContain("Use --force to lint it anyway")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("processes excluded file with --force", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            exclude:
              - "test-file-with-errors.html.erb"
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--force")

        expect(output).toContain("Forcing linter on excluded file")
        expect(output).toContain("Missing required")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })
  })
})
