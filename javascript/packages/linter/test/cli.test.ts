import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

describe("CLI Output Formatting", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function runLinter(fixture: string, ...args: string[]): { output: string, exitCode: number } {
    try {
      const { execSync } = require("child_process")
      const allArgs = [...args, "--no-timing"].join(' ')

      const output = execSync(`bin/herb-lint test/fixtures/${fixture} ${allArgs}`, {
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" }
      })

      return { output: output.trim(), exitCode: 0 }
    } catch (error: any) {
      return { output: error.stdout.toString().trim(), exitCode: error.status }
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

  test("enables line wrapping by default", () => {
    const { output } = runLinter("long-line.html.erb")

    expect(output).toContain("        │")

    const lines = output.split('\n')
    const wrappedLines = lines.filter(line => line.match(/^\s+│\s/))
    expect(wrappedLines.length).toBeGreaterThan(0)
  })

  test("correctly passes filename context for file-specific rules", () => {
    const { output, exitCode } = runLinter("no-trailing-newline.html.erb", "--simple", "--no-wrap-lines")

    expect(output).toContain("erb-requires-trailing-newline")
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
})
