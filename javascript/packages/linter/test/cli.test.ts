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
    const { output, exitCode } = runLinter("test-file-with-errors.html.erb")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats simple output correctly", () => {
    const { output, exitCode } = runLinter("test-file-simple.html.erb", "--simple")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })

  test("formats success output correctly", () => {
    const { output, exitCode } = runLinter("clean-file.html.erb")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(0)
  })

  test("handles multiple errors correctly", () => {
    const { output, exitCode } = runLinter("bad-file.html.erb")

    expect(output).toMatchSnapshot()
    expect(exitCode).toBe(1)
  })
})
