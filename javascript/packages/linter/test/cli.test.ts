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

  test("allows tag.attributes in attribute position", () => {
    const { output, exitCode } = runLinter("tag-attributes.html.erb", "--no-wrap-lines")

    expect(output).toMatchSnapshot()
    expect(output).not.toContain("erb-no-output-in-attribute-position")
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

    expect(output).not.toMatch(/^::warning/)
    expect(output).toMatch(/warning.*Missing required.*alt.*attribute/)
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

    test("skips excluded file in subdirectory with README.md project indicator", () => {
      const { mkdirSync, rmSync } = require("fs")
      const subdir = "test/fixtures/subdir"

      try {
        mkdirSync(subdir, { recursive: true })
        writeFileSync(`${subdir}/README.md`, "# Subdir\n")
        writeFileSync(`${subdir}/excluded.html.erb`, '<img>\n')

        writeFileSync(configPath, dedent`
          linter:
            exclude:
              - "subdir/**/*.html.erb"
        `)

        const { output, exitCode } = runLinter("subdir/excluded.html.erb")

        expect(output).toMatchSnapshot()
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { rmSync(subdir, { recursive: true, force: true }) } catch {}
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

    test("prints a progress message when linting multiple files", () => {
      const { output, exitCode } = runLinterMultiFile("clean-file.html.erb", "boolean-attribute.html.erb")

      expect(output).toContain("Found 2 files, linting...")
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

  describe("--log-level", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    const OFFENSE_MESSAGE = "Missing required `alt` attribute"

    const hintConfig = dedent`
      linter:
        rules:
          html-img-require-alt:
            severity: hint
          html-tag-name-lowercase:
            enabled: false
    `

    test("doesn't report offenses below the given level", () => {
      try {
        writeFileSync(configPath, hintConfig)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--log-level", "warning")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain(OFFENSE_MESSAGE)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("still reports offenses at or above the given level", () => {
      try {
        writeFileSync(configPath, hintConfig)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--log-level", "hint")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain("Not shown")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("counts the hidden offenses and suggests the level that reveals them", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                severity: hint
              html-tag-name-lowercase:
                severity: info
        `)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--log-level", "warning")

        expect(output).toMatchSnapshot()
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("still counts hidden offenses towards the exit code", () => {
      try {
        writeFileSync(configPath, hintConfig)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--log-level", "warning", "--fail-level", "hint")

        expect(output).toMatchSnapshot()
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("reads logLevel from the config file", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            logLevel: warning
            rules:
              html-img-require-alt:
                severity: hint
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain(OFFENSE_MESSAGE)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("prefers the CLI flag over the config file", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            logLevel: warning
            rules:
              html-img-require-alt:
                severity: hint
              html-tag-name-lowercase:
                enabled: false
        `)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--log-level", "hint")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain("Not shown")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("omits GitHub Actions annotations for offenses below the given level", () => {
      try {
        writeFileSync(configPath, hintConfig)

        const { output } = runLinter("test-file-with-errors.html.erb", "--github", "--log-level", "warning")

        expect(output).not.toContain("::notice")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("omits offenses below the given level from JSON output but keeps the counts", () => {
      try {
        writeFileSync(configPath, hintConfig)

        const { output } = runLinter("test-file-with-errors.html.erb", "--json", "--log-level", "warning")
        const result = JSON.parse(output)

        expect(result.offenses).toHaveLength(0)
        expect(result.summary.totalHints).toBe(1)
        expect(result.summary.totalNotReported).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("exits with error for invalid --log-level value", () => {
      const { output, exitCode } = runLinter("clean-file.html.erb", "--log-level", "invalid")

      expect(output).toContain("Invalid --log-level value")
      expect(output).toContain("invalid")
      expect(exitCode).toBe(1)
    })
  })

  describe("non-failing offenses tip", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    const noisyConfig = dedent`
      linter:
        rules:
          html-anchor-require-href:
            severity: hint
          html-attribute-double-quotes:
            severity: hint
          html-attribute-values-require-quotes:
            severity: hint
          html-img-require-alt:
            severity: hint
          html-no-empty-attributes:
            severity: hint
          html-no-empty-headings:
            severity: info
    `

    const quietConfig = dedent`
      linter:
        rules:
          html-no-empty-headings:
            severity: warning
    `

    test("points at --log-level when many offenses don't fail the build", () => {
      try {
        writeFileSync(configPath, noisyConfig)

        const { output } = runLinter("multiple-rule-offenses.html.erb", "--simple")

        expect(output).toMatchSnapshot()
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("stays quiet when only a handful of offenses don't fail the build", () => {
      try {
        writeFileSync(configPath, quietConfig)

        const { output } = runLinter("multiple-rule-offenses.html.erb", "--simple")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain("don't fail the build")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("stays quiet when --log-level is already narrowing the output", () => {
      try {
        writeFileSync(configPath, noisyConfig)

        const { output } = runLinter("multiple-rule-offenses.html.erb", "--simple", "--log-level", "warning")

        expect(output).toMatchSnapshot()
        expect(output).not.toContain("don't fail the build")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test.each(["--json", "--github"])("stays quiet for %s output", (formatFlag) => {
      try {
        writeFileSync(configPath, noisyConfig)

        const { output } = runLinter("multiple-rule-offenses.html.erb", formatFlag)

        expect(output).not.toContain("TIP:")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })
  })

  describe("summary offense buckets", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    const mixedSeverityConfig = dedent`
      linter:
        rules:
          html-img-require-alt:
            severity: hint
          html-no-empty-headings:
            severity: info
    `

    test.each(["warning", "info", "hint"])("groups every severity into one line when --fail-level is %s", (failLevel) => {
      const { output, exitCode } = runLinter("multiple-rule-offenses.html.erb", "--simple", "--fail-level", failLevel)

      expect(output).toMatchSnapshot()
      expect(output).not.toContain("Not failing")
      expect(exitCode).toBe(1)
    })

    test("splits the buckets when only some severities fail the build", () => {
      try {
        writeFileSync(configPath, mixedSeverityConfig)

        const { output, exitCode } = runLinter("multiple-rule-offenses.html.erb", "--simple", "--fail-level", "warning")

        expect(output).toMatchSnapshot()
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("moves a severity between buckets as --fail-level is lowered", () => {
      try {
        writeFileSync(configPath, mixedSeverityConfig)

        const { output, exitCode } = runLinter("multiple-rule-offenses.html.erb", "--simple", "--fail-level", "info")

        expect(output).toMatchSnapshot()
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })
  })

  describe("unsafe autocorrectable offenses", () => {
    const rules = "--only html-no-unescaped-entities,html-tag-name-lowercase"

    test("counts and tags them separately from offenses --fix can correct", () => {
      const { output } = runLinter("unsafe-autocorrectable.html.erb", "--simple", ...rules.split(" "))

      expect(output).toMatchSnapshot()
    })

    test("labels unsafe offenses as autocorrectable when no safe fix is available", () => {
      const { output } = runLinter("unsafe-autocorrectable.html.erb", "--simple", "--only", "html-no-unescaped-entities")

      expect(output).toMatchSnapshot()
    })
  })

  describe("--only", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    test("only reports offenses for the given rule", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-require-alt")

      expect(output).toContain("html-img-require-alt")
      expect(output).not.toContain("html-tag-name-lowercase")
      expect(output).toContain("1 enabled | filtered by --only")
      expect(exitCode).toBe(0)
    })

    test("accepts a comma-separated list of rules", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-require-alt,html-tag-name-lowercase")

      expect(output).toContain("html-img-require-alt")
      expect(output).toContain("html-tag-name-lowercase")
      expect(output).toContain("2 enabled | filtered by --only")
      expect(exitCode).toBe(1)
    })

    test("can be passed multiple times", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-require-alt", "--only", "html-tag-name-lowercase")

      expect(output).toContain("html-img-require-alt")
      expect(output).toContain("html-tag-name-lowercase")
      expect(output).toContain("2 enabled | filtered by --only")
      expect(exitCode).toBe(1)
    })

    test("runs rules that are disabled in .herb.yml", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-img-require-alt:
                enabled: false
        `)

        const withoutOnly = runLinter("test-file-with-errors.html.erb", "--simple")
        expect(withoutOnly.output).not.toContain("html-img-require-alt")

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-require-alt")

        expect(output).toContain("html-img-require-alt")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("ignores rule-level exclude patterns from .herb.yml", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-tag-name-lowercase:
                exclude:
                  - '**/*.html.erb'
        `)

        const withoutOnly = runLinter("test-file-with-errors.html.erb", "--simple")
        expect(withoutOnly.output).not.toContain("html-tag-name-lowercase")

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-tag-name-lowercase")

        expect(output).toContain("html-tag-name-lowercase")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("only fixes offenses of the given rules", () => {
      const fixturePath = "test/fixtures/only-fix.html.erb"
      const { readFileSync } = require("fs")

      try {
        writeFileSync(fixturePath, dedent`
          <DIV>
            <img src="test.jpg">
          </DIV>
        ` + "\n")

        const { output } = runLinter("only-fix.html.erb", "--simple", "--fix", "--only", "html-tag-name-lowercase")
        const fixedContent = readFileSync(fixturePath, "utf-8")

        expect(output).toContain("Fixed 2 offenses")
        expect(fixedContent).toContain("<div>")
        expect(fixedContent).toContain(`<img src="test.jpg">`)
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("leaves autocorrectable offenses of other rules untouched", () => {
      const fixturePath = "test/fixtures/only-fix-other-rules.html.erb"
      const { readFileSync } = require("fs")

      try {
        writeFileSync(fixturePath, dedent`
          <DIV>
            <img src='test.jpg' alt='test'>
          </DIV>
        ` + "\n")

        const { output } = runLinter("only-fix-other-rules.html.erb", "--simple", "--fix", "--only", "html-tag-name-lowercase")
        const fixedContent = readFileSync(fixturePath, "utf-8")

        expect(output).toContain("Fixed 2 offenses")
        expect(fixedContent).toContain("<div>")
        expect(fixedContent).toContain(`<img src='test.jpg' alt='test'>`)

        runLinter("only-fix-other-rules.html.erb", "--simple", "--fix")

        expect(readFileSync(fixturePath, "utf-8")).toContain(`<img src="test.jpg" alt="test">`)
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("fixes rules that are disabled in .herb.yml", () => {
      const fixturePath = "test/fixtures/only-fix-disabled.html.erb"
      const { readFileSync } = require("fs")

      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-tag-name-lowercase:
                enabled: false
        `)

        writeFileSync(fixturePath, `<DIV>test</DIV>\n`)

        const { output } = runLinter("only-fix-disabled.html.erb", "--simple", "--fix", "--only", "html-tag-name-lowercase")

        expect(output).toContain("Fixed 2 offenses")
        expect(readFileSync(fixturePath, "utf-8")).toBe("<div>test</div>\n")
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("applies unsafe fixes with --fix-unsafely", () => {
      const fixturePath = "test/fixtures/only-fix-unsafely.html.erb"
      const { readFileSync } = require("fs")

      try {
        writeFileSync(fixturePath, `<div>Tom & Jerry</div>\n`)

        const safe = runLinter("only-fix-unsafely.html.erb", "--simple", "--fix", "--only", "html-no-unescaped-entities")

        expect(safe.output).not.toContain("Fixed")
        expect(readFileSync(fixturePath, "utf-8")).toBe("<div>Tom & Jerry</div>\n")

        const unsafe = runLinter("only-fix-unsafely.html.erb", "--simple", "--fix-unsafely", "--only", "html-no-unescaped-entities")

        expect(unsafe.output).toContain("Fixed 1 offense")
        expect(readFileSync(fixturePath, "utf-8")).toBe("<div>Tom &amp; Jerry</div>\n")
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("exits with an error for unknown rule names", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-require-altt")

      expect(output).toContain("Unknown rule html-img-require-altt passed to --only")
      expect(output).toContain("Did you mean html-img-require-alt?")
      expect(exitCode).toBe(1)
    })

    test("suggests the full rule name for a partial rule name", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "erb-no-silent")

      expect(output).toContain("Unknown rule erb-no-silent passed to --only")
      expect(output).toContain("Did you mean erb-no-silent-statement?")
      expect(exitCode).toBe(1)
    })

    test("doesn't suggest a rule name when nothing is close", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "zzzzzzzzzzzzzzzzzzzzzz")

      expect(output).toContain("Unknown rule zzzzzzzzzzzzzzzzzzzzzz passed to --only")
      expect(output).not.toContain("Did you mean")
      expect(exitCode).toBe(1)
    })

    test("reports every unknown rule name", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-img-alt,html-tag-name-lowercase,html-lowercase-tag")

      expect(output).toContain("Unknown rule html-img-alt passed to --only")
      expect(output).toContain("Unknown rule html-lowercase-tag passed to --only")
      expect(output).not.toContain("Unknown rule html-tag-name-lowercase")
      expect(exitCode).toBe(1)
    })

    test("reports unknown rule names in the JSON output", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--json", "--only", "html-img-require-altt")
      const result = JSON.parse(output)

      expect(result.completed).toBe(false)
      expect(result.message).toContain("Unknown rule html-img-require-altt passed to --only")
      expect(result.offenses).toEqual([])
      expect(exitCode).toBe(1)
    })

    test("exits with an error when no rule name is given", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", `""`)

      expect(output).toContain("--only requires at least one rule name")
      expect(exitCode).toBe(1)
    })

    test("runs rules that are not enabled by default", () => {
      const fixturePath = "test/fixtures/only-not-enabled-by-default.html.erb"

      try {
        writeFileSync(fixturePath, `<div disabled>Save</div>\n`)

        const withoutOnly = runLinter("only-not-enabled-by-default.html.erb", "--simple")
        expect(withoutOnly.output).not.toContain("a11y-disabled-attribute")

        const { output } = runLinter("only-not-enabled-by-default.html.erb", "--simple", "--only", "a11y-disabled-attribute")

        expect(output).toContain("a11y-disabled-attribute")
        expect(output).toContain("1 enabled | filtered by --only")
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("runs rules that are skipped by the version in .herb.yml", () => {
      const fixturePath = "test/fixtures/only-version-gated.html.erb"

      try {
        writeFileSync(configPath, dedent`
          version: 0.4.0
        `)

        writeFileSync(fixturePath, dedent`
          <div>
            <foobar>hi</foobar>
          </div>
        ` + "\n")

        const withoutOnly = runLinter("only-version-gated.html.erb", "--simple")
        expect(withoutOnly.output).toContain("New rules available")
        expect(withoutOnly.output).not.toContain("Unknown HTML tag")

        const { output } = runLinter("only-version-gated.html.erb", "--simple", "--only", "html-no-unknown-tag")

        expect(output).toContain("html-no-unknown-tag")
        expect(output).not.toContain("New rules available")
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("still respects herb:disable comments", () => {
      const fixturePath = "test/fixtures/only-disable-comment.html.erb"

      try {
        writeFileSync(fixturePath, dedent`
          <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
        ` + "\n")

        const { output, exitCode } = runLinter("only-disable-comment.html.erb", "--simple", "--only", "html-tag-name-lowercase")

        expect(output).not.toContain("should be lowercase")
        expect(output).toContain("2 offenses suppressed with herb:disable")
        expect(exitCode).toBe(0)

        const ignoring = runLinter("only-disable-comment.html.erb", "--simple", "--only", "html-tag-name-lowercase", "--ignore-disable-comments")

        expect(ignoring.output).toContain("should be lowercase")
        expect(ignoring.exitCode).toBe(1)
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("applies when the run is split across workers", () => {
      const { output, exitCode } = runLinter("parallel", "--jobs", "4", "--json", "--only", "html-tag-name-lowercase")
      const result = JSON.parse(output)

      expect(result.offenses).toHaveLength(0)
      expect(result.summary.ruleCount).toBe(1)
      expect(exitCode).toBe(0)
    })
  })

  describe("--all-rules", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    test("reports nothing for the fixture with the default rule set", () => {
      const { output, exitCode } = runLinter("all-rules.html.erb", "--simple", "--no-wrap-lines")

      expect(output).toMatchSnapshot()
      expect(exitCode).toBe(0)
    })

    test("reports every offense for the fixture with --all-rules", () => {
      const { output, exitCode } = runLinter("all-rules.html.erb", "--simple", "--no-wrap-lines", "--all-rules")

      expect(output).toMatchSnapshot()
      expect(exitCode).toBe(0)
    })

    test("runs rules that are not enabled by default", () => {
      const fixturePath = "test/fixtures/all-rules-not-enabled-by-default.html.erb"

      try {
        writeFileSync(fixturePath, `<div disabled>Save</div>\n`)

        const withoutAllRules = runLinter("all-rules-not-enabled-by-default.html.erb", "--simple")
        expect(withoutAllRules.output).not.toContain("a11y-disabled-attribute")

        const { output } = runLinter("all-rules-not-enabled-by-default.html.erb", "--simple", "--all-rules")

        expect(output).toContain("a11y-disabled-attribute")
        expect(output).toContain("all rules via --all-rules")
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("runs rules that are disabled in .herb.yml", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-tag-name-lowercase:
                enabled: false
        `)

        const withoutAllRules = runLinter("test-file-with-errors.html.erb", "--simple")
        expect(withoutAllRules.output).not.toContain("html-tag-name-lowercase")

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--all-rules")

        expect(output).toContain("html-tag-name-lowercase")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("runs rules that are skipped by the version in .herb.yml", () => {
      const fixturePath = "test/fixtures/all-rules-version-gated.html.erb"

      try {
        writeFileSync(configPath, dedent`
          version: 0.4.0
        `)

        writeFileSync(fixturePath, dedent`
          <div>
            <foobar>hi</foobar>
          </div>
        ` + "\n")

        const withoutAllRules = runLinter("all-rules-version-gated.html.erb", "--simple")
        expect(withoutAllRules.output).toContain("New rules available")
        expect(withoutAllRules.output).not.toContain("Unknown HTML tag")

        const { output } = runLinter("all-rules-version-gated.html.erb", "--simple", "--all-rules")

        expect(output).toContain("html-no-unknown-tag")
        expect(output).not.toContain("New rules available")
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("ignores rule-level exclude patterns from .herb.yml", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              html-tag-name-lowercase:
                exclude:
                  - '**/*.html.erb'
        `)

        const withoutAllRules = runLinter("test-file-with-errors.html.erb", "--simple")
        expect(withoutAllRules.output).not.toContain("html-tag-name-lowercase")

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--all-rules")

        expect(output).toContain("html-tag-name-lowercase")
        expect(exitCode).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("still respects herb:disable comments", () => {
      const fixturePath = "test/fixtures/all-rules-disable-comment.html.erb"

      try {
        writeFileSync(fixturePath, dedent`
          <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
        ` + "\n")

        const { output } = runLinter("all-rules-disable-comment.html.erb", "--simple", "--all-rules")

        expect(output).not.toContain("should be lowercase")
        expect(output).toContain("2 offenses suppressed with herb:disable")

        const ignoring = runLinter("all-rules-disable-comment.html.erb", "--simple", "--all-rules", "--ignore-disable-comments")

        expect(ignoring.output).toContain("should be lowercase")
      } finally {
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("applies when the run is split across workers", () => {
      const withoutAllRules = JSON.parse(runLinter("parallel", "--jobs", "4", "--json").output)
      const { output, exitCode } = runLinter("parallel", "--jobs", "4", "--json", "--all-rules")
      const result = JSON.parse(output)

      expect(result.summary.ruleCount).toBeGreaterThan(withoutAllRules.summary.ruleCount)
      expect(exitCode).toBe(0)
    })

    test("can't be combined with --only", () => {
      const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple", "--all-rules", "--only", "html-tag-name-lowercase")

      expect(output).toContain("--only and --all-rules can't be combined")
      expect(exitCode).toBe(1)
    })
  })

  describe("`all` pseudo rule in .herb.yml", () => {
    const { writeFileSync, unlinkSync } = require("fs")
    const configPath = "test/fixtures/.herb.yml"

    test("`all: enabled: false` only runs the rules that are opted back in", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              all:
                enabled: false
              html-img-require-alt:
                enabled: true
        `)

        const { output, exitCode } = runLinter("test-file-with-errors.html.erb", "--simple")

        expect(output).toContain("html-img-require-alt")
        expect(output).not.toContain("html-tag-name-lowercase")
        expect(output).toContain("1 enabled")
        expect(exitCode).toBe(0)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("`all: enabled: true` runs rules that are not enabled by default", () => {
      const fixturePath = "test/fixtures/all-pseudo-rule-not-enabled-by-default.html.erb"

      try {
        writeFileSync(fixturePath, `<div disabled>Save</div>\n`)

        const withoutAll = runLinter("all-pseudo-rule-not-enabled-by-default.html.erb", "--simple")
        expect(withoutAll.output).not.toContain("a11y-disabled-attribute")

        writeFileSync(configPath, dedent`
          linter:
            rules:
              all:
                enabled: true
        `)

        const { output } = runLinter("all-pseudo-rule-not-enabled-by-default.html.erb", "--simple")

        expect(output).toContain("a11y-disabled-attribute")
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("does not hold back rules gated by the version in .herb.yml", () => {
      const fixturePath = "test/fixtures/all-pseudo-rule-version-gated.html.erb"

      try {
        writeFileSync(fixturePath, dedent`
          <div>
            <foobar>hi</foobar>
          </div>
        ` + "\n")

        writeFileSync(configPath, dedent`
          version: 0.4.0
        `)

        const withoutAll = runLinter("all-pseudo-rule-version-gated.html.erb", "--simple")
        expect(withoutAll.output).toContain("New rules available")

        writeFileSync(configPath, dedent`
          version: 0.4.0
          linter:
            rules:
              all:
                enabled: true
        `)

        const { output } = runLinter("all-pseudo-rule-version-gated.html.erb", "--simple")

        expect(output).toContain("html-no-unknown-tag")
        expect(output).not.toContain("New rules available")
      } finally {
        try { unlinkSync(configPath) } catch {}
        try { unlinkSync(fixturePath) } catch {}
      }
    })

    test("--only takes precedence over a disabled `all`", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              all:
                enabled: false
        `)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--only", "html-tag-name-lowercase")

        expect(output).toContain("html-tag-name-lowercase")
        expect(output).toContain("1 enabled | filtered by --only")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("--all-rules takes precedence over a disabled `all`", () => {
      try {
        writeFileSync(configPath, dedent`
          linter:
            rules:
              all:
                enabled: false
        `)

        const { output } = runLinter("test-file-with-errors.html.erb", "--simple", "--all-rules")

        expect(output).toContain("html-tag-name-lowercase")
        expect(output).toContain("all rules via --all-rules")
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })

    test("applies when the run is split across workers", () => {
      try {
        const withoutAll = JSON.parse(runLinter("parallel", "--jobs", "4", "--json").output)

        writeFileSync(configPath, dedent`
          linter:
            rules:
              all:
                enabled: false
              html-img-require-alt:
                enabled: true
        `)

        const result = JSON.parse(runLinter("parallel", "--jobs", "4", "--json").output)

        expect(withoutAll.summary.ruleCount).toBeGreaterThan(1)
        expect(result.summary.ruleCount).toBe(1)
      } finally {
        try { unlinkSync(configPath) } catch {}
      }
    })
  })

  describe("Directory Scoping (issue #1045)", () => {
    const { mkdirSync, writeFileSync, rmSync, existsSync } = require("fs")
    const { join } = require("path")
    const tempDir = "test/fixtures/directory-scoping-test"

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

    test("only processes files within the specified directory", () => {
      try {
        // Create directory structure:
        // tempDir/
        //   .herb.yml
        //   public/
        //     file.html.erb (should NOT be processed)
        //   app/
        //     views/
        //       file.html.erb (should be processed)
        mkdirSync(join(tempDir, "public"), { recursive: true })
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, "public/file.html.erb"), `<img src="test.png" alt="test">\n`)
        writeFileSync(join(tempDir, "app/views/file.html.erb"), `<div>clean file</div>\n`)

        const { output, exitCode } = runLinterFromPath(join(tempDir, "app/views"))

        expect(output).toContain("Checked      1 file")
        expect(output).not.toContain("public/file.html.erb")
        expect(exitCode).toBe(0)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("processes all files when run from project root", () => {
      try {
        mkdirSync(join(tempDir, "public"), { recursive: true })
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, "public/file.html.erb"), `<div>public file</div>\n`)
        writeFileSync(join(tempDir, "app/views/file.html.erb"), `<div>views file</div>\n`)

        const { output, exitCode } = runLinterFromPath(tempDir)

        expect(output).toContain("Checked      2 files")
        expect(exitCode).toBe(0)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })

  describe("Custom Rules from Project Root (issue #908)", () => {
    const { mkdirSync, writeFileSync, rmSync, existsSync } = require("fs")
    const { join } = require("path")
    const tempDir = "test/fixtures/custom-rules-test"

    function runLinterFromPath(filePath: string, ...args: string[]): { output: string, exitCode: number } {
      try {
        const { execSync } = require("child_process")

        const output = execSync(`bin/herb-lint ${filePath} ${args.join(" ")} --no-timing 2>&1`, {
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
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, ".herb/rules/no-hello-world.mjs"), dedent`
          export default class NoHelloWorldRule {
            static ruleName = "no-hello-world"

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

    test("can select a custom rule with --only", () => {
      try {
        mkdirSync(join(tempDir, ".herb/rules"), { recursive: true })
        mkdirSync(join(tempDir, "app/views/widgets"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, ".herb/rules/no-hello-world.mjs"), dedent`
          export default class NoHelloWorldRule {
            static ruleName = "no-hello-world"

            check(document, context) {
              const source = document.source || ""

              if (!source.includes("hello world")) return []

              return [{
                message: "Text contains 'hello world' which is not allowed",
                location: {
                  start: { line: 1, column: 1 },
                  end: { line: 1, column: 22 }
                }
              }]
            }
          }
        `)

        writeFileSync(join(tempDir, "app/views/widgets/test.html.erb"), `<DIV>hello world</DIV>\n`)

        const { output, exitCode } = runLinterFromPath(join(tempDir, "app/views/widgets/test.html.erb"), "--simple", "--only", "no-hello-world")

        expect(output).toContain("Text contains 'hello world' which is not allowed")
        expect(output).not.toContain("html-tag-name-lowercase")
        expect(output).toContain("1 enabled | filtered by --only")
        expect(exitCode).toBe(1)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("suggests a custom rule name for an unknown --only rule", () => {
      try {
        mkdirSync(join(tempDir, ".herb/rules"), { recursive: true })
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, ".herb/rules/no-hello-world.mjs"), dedent`
          export default class NoHelloWorldRule {
            static ruleName = "no-hello-world"

            check(document, context) {
              return []
            }
          }
        `)

        writeFileSync(join(tempDir, "app/views/test.html.erb"), "<div></div>\n")

        const { output, exitCode } = runLinterFromPath(join(tempDir, "app/views/test.html.erb"), "--simple", "--only", "no-hello-wold")

        expect(output).toContain("Unknown rule no-hello-wold passed to --only")
        expect(output).toContain("Did you mean no-hello-world?")
        expect(exitCode).toBe(1)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("exits with an error when a custom rule uses the deprecated 'name' instance property", () => {
      try {
        mkdirSync(join(tempDir, ".herb/rules"), { recursive: true })
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.10.3
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, ".herb/rules/deprecated-rule.mjs"), dedent`
          export default class DeprecatedRule {
            name = "deprecated-rule"

            check(document, context) {
              return []
            }
          }
        `)

        writeFileSync(join(tempDir, "app/views/test.html.erb"), "<div></div>")

        const { output, exitCode } = runLinterFromPath(join(tempDir, "app/views/test.html.erb"))

        expect(output).toContain("sets 'name' as an instance property")
        expect(output).toContain("static ruleName = \"deprecated-rule\"")
        expect(exitCode).toBe(1)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })

  describe("--upgrade", () => {
    const { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } = require("fs")
    const { join } = require("path")
    const tempDir = "test/fixtures/upgrade-test"

    function runUpgrade(projectPath: string): { output: string, exitCode: number } {
      try {
        const { execSync } = require("child_process")

        const output = execSync(`bin/herb-lint ${projectPath} --upgrade 2>&1`, {
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

    test("disables new rules that have offenses", () => {
      try {
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.9.2
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, "app/views/file.html.erb"), `<unknowntag>content</unknowntag>\n`)

        const { output, exitCode } = runUpgrade(tempDir)

        expect(exitCode).toBe(0)
        expect(output).toContain("html-no-unknown-tag")
        expect(output).toContain("Disabled")

        const configContent = readFileSync(join(tempDir, ".herb.yml"), "utf-8")
        expect(configContent).toContain("html-no-unknown-tag")
        expect(configContent).toMatch(/html-no-unknown-tag[\s\S]*enabled:\s*false/)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("enables new rules that have no offenses", () => {
      try {
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.9.2
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, "app/views/file.html.erb"), `<div>clean content</div>\n`)

        const { output, exitCode } = runUpgrade(tempDir)

        expect(exitCode).toBe(0)
        expect(output).toContain("Enabled")
        expect(output).toContain("no offenses found")
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("correctly splits rules when some have offenses and others do not", () => {
      try {
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.9.2
          linter:
            enabled: true
        `)

        writeFileSync(join(tempDir, "app/views/file.html.erb"), `<unknowntag>content</unknowntag>\n`)

        const { output, exitCode } = runUpgrade(tempDir)

        expect(exitCode).toBe(0)

        expect(output).toContain("Enabled")
        expect(output).toContain("no offenses found")
        expect(output).toContain("Disabled")

        const configContent = readFileSync(join(tempDir, ".herb.yml"), "utf-8")
        expect(configContent).toContain("html-no-unknown-tag")
        expect(configContent).toMatch(/html-no-unknown-tag[\s\S]*enabled:\s*false/)
        expect(configContent).not.toContain("a11y-no-accesskey-attribute")
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    test("detects offenses from new rules with many files", () => {
      try {
        mkdirSync(join(tempDir, "app/views"), { recursive: true })

        writeFileSync(join(tempDir, ".herb.yml"), dedent`
          version: 0.9.2
          linter:
            enabled: true
        `)

        for (let index = 0; index < 11; index++) {
          writeFileSync(join(tempDir, `app/views/clean_${index}.html.erb`), `<div>clean</div>\n`)
        }

        writeFileSync(join(tempDir, "app/views/bad.html.erb"), `<unknowntag>content</unknowntag>\n`)

        const { output, exitCode } = runUpgrade(tempDir)

        expect(exitCode).toBe(0)
        expect(output).toContain("html-no-unknown-tag")
        expect(output).toContain("Disabled")

        const configContent = readFileSync(join(tempDir, ".herb.yml"), "utf-8")
        expect(configContent).toMatch(/html-no-unknown-tag[\s\S]*enabled:\s*false/)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })

  describe("parallel linting", () => {
    test("emits JSON when the run is split across workers", () => {
      const { output, exitCode } = runLinter("parallel", "--jobs", "4", "--json")
      const result = JSON.parse(output)

      expect(result.completed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.offenses).toHaveLength(12)
      expect(result.offenses[0].location.start).toEqual({ line: 2, column: 3 })
      expect(exitCode).toBe(0)
    })

    test("produces the same JSON with and without workers", () => {
      const parallel = JSON.parse(runLinter("parallel", "--jobs", "4", "--json").output)
      const serial = JSON.parse(runLinter("parallel", "--jobs", "1", "--json").output)

      const normalize = (result: any) => result.offenses.map((offense: any) => ({ ...offense, filename: offense.filename })).sort((a: any, b: any) => a.filename.localeCompare(b.filename))

      expect(normalize(parallel)).toEqual(normalize(serial))
    })
  })
})
