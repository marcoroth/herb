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

  describe("Multiple File Arguments", () => {
    function runLinterMultiFile(...files: string[]): { output: string, exitCode: number } {
      try {
        const { execSync } = require("child_process")
        const fileArgs = files.map(f => `test/fixtures/${f}`).join(' ')

        const output = execSync(`bin/herb-lint ${fileArgs} --no-timing 2>&1`, {
          encoding: "utf-8",
          env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }
        })

        return { output: output.trim(), exitCode: 0 }
      } catch (error: any) {
        const stderr = error.stderr ? error.stderr.toString().trim() : ""
        const stdout = error.stdout ? error.stdout.toString().trim() : ""
        const combined = (stdout + "\n" + stderr).trim()

        return { output: combined || stderr || stdout, exitCode: error.status }
      }
    }

    test("lints multiple files successfully", () => {
      const { output, exitCode } = runLinterMultiFile("clean-file.html.erb", "boolean-attribute.html.erb")

      expect(output).toContain("All files are clean")
      expect(output).toContain("Checked      2 files")
      expect(exitCode).toBe(0)
    })

    test("lints multiple files with errors", () => {
      const { output, exitCode } = runLinterMultiFile("test-file-with-errors.html.erb", "bad-file.html.erb")

      expect(output).toContain("test-file-with-errors.html.erb")
      expect(output).toContain("bad-file.html.erb")
      expect(exitCode).toBe(1)
    })

    test("exits with error if one file doesn't exist", () => {
      const { output, exitCode } = runLinterMultiFile("clean-file.html.erb", "nonexistent-file.html.erb")

      expect(output).toContain("No files found matching pattern")
      expect(output).toContain("nonexistent-file.html.erb")
      expect(exitCode).toBe(1)
    })

    test("deduplicates files when passed multiple times", () => {
      const { output, exitCode } = runLinterMultiFile("test-file-with-errors.html.erb", "test-file-with-errors.html.erb")

      const fileMatches = (output.match(/test-file-with-errors\.html\.erb/g) || []).length

      expect(fileMatches).toBeGreaterThan(0)
      expect(exitCode).toBe(1)
    })
  })

  describe("--fail-level", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    test("exits with error code when warnings are present with --fail-level warning flag", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: warning
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "warning")

        expect(output).toContain("warning")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with success when no warnings are present with --fail-level warning flag", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: warning
        `)

        const { exitCode } = runLinter("clean-file.html.erb", "--fail-level", "warning")

        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with error code when failLevel is set in config", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            failLevel: warning
            rules:
              html-img-require-alt:
                severity: warning
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb")

        expect(output).toContain("warning")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("CLI flag overrides config setting", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            failLevel: error
            rules:
              html-img-require-alt:
                severity: warning
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "warning")

        expect(output).toContain("warning")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with error for invalid --fail-level value", () => {
      const { output, exitCode } = runLinter("clean-file.html.erb", "--fail-level", "invalid")

      expect(output).toContain("Invalid --fail-level value")
      expect(output).toContain("invalid")
      expect(exitCode).toBe(1)
    })

    test("exits with success when warnings present but --fail-level not set", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: warning
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb")

        expect(output).toContain("warning")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with error code when info diagnostics are present with --fail-level info flag", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: info
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "info")

        expect(output).toContain("info")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with success when info diagnostics present but --fail-level is warning", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: info
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "warning")

        expect(output).toContain("info")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with error code when hint diagnostics are present with --fail-level hint flag", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: hint
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "hint")

        expect(output).toContain("hint")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with success when hint diagnostics present but --fail-level is info", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: hint
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--fail-level", "info")

        expect(output).toContain("hint")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })
  })

  describe("Custom Rules from Project Root (issue #908)", () => {
    const { mkdirSync, writeFileSync, rmSync, existsSync } = require("fs")
    const { join } = require("path")
    const tempDir = "test/fixtures/custom-rules-test"

    function runLinterFromPath(filePath: string): { output: string, exitCode: number } {
      try {
        const { execSync } = require("child_process")

        const output = execSync(`bin/herb-lint ${filePath} --no-timing 2>&1`, {
          encoding: "utf-8",
          env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined, GITHUB_ACTIONS: undefined }
        })

        return { output: output.trim(), exitCode: 0 }
      } catch (error: any) {
        const stderr = error.stderr ? error.stderr.toString().trim() : ""
        const stdout = error.stdout ? error.stdout.toString().trim() : ""
        const combined = (stdout + "\n" + stderr).trim()

        return { output: combined || stderr || stdout, exitCode: error.status }
      }
    }

    test("loads custom rules when linting a file in a nested directory", () => {
      try {
        mkdirSync(join(tempDir, ".herb/rules"), { recursive: true })
        mkdirSync(join(tempDir, "app/views/widgets"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.8.7
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, ".herb/rules/no-hello-world.mjs"), dedent`
          export default class NoHelloWorldRule {
            name = "no-hello-world"

            check(document, context) {
              const errors = []
              const source = document.source || ""

              if (source.includes("hello world")) {
                errors.push({
                  message: "Text contains 'hello world' which is not allowed",
                  location: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 22 }
                  }
                })
              }

              return errors
            }
          }
        `)

        const testFile = `<div>hello world</div>`
        writeFileSync(join(tempDir, "app/views/widgets/test.html.erb"), testFile)

        const { output, exitCode } = runLinterFromPath(join(tempDir, "app/views/widgets/test.html.erb"))

        expect(output).toContain("Loaded 1 custom rule")
        expect(output).toContain("no-hello-world")
        expect(output).toContain("Text contains 'hello world' which is not allowed")
        expect(exitCode).toBe(1)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })
})
