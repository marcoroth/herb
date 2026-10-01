import { describe, test, expect } from "vitest"
import { execSync } from "child_process"
import { readFileSync, writeFileSync, rmSync } from "fs"

function run(...args: string[]): { output: string, exitCode: number } {
  try {
    const output = execSync(`node bin/herb-minify ${args.join(" ")} 2>&1`, {
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined },
    })

    return { output: output.trim(), exitCode: 0 }
  } catch (error: any) {
    const stdout = error.stdout ? error.stdout.toString() : ""
    const stderr = error.stderr ? error.stderr.toString() : ""

    return { output: (stdout + stderr).trim(), exitCode: error.status ?? 1 }
  }
}

describe("herb-minify", () => {
  test("prints the minified template to stdout", () => {
    const { output, exitCode } = run("test/fixtures/basic.html.erb")

    expect(exitCode).toBe(0)
    expect(output).toBe(`<div class="container"><h1>Hello <b>World</b></h1><%if admin?%><p>Admin</p><%end%><pre>\n    keep   me\n  </pre></div>`)
  })

  test("reports how many bytes were saved", () => {
    const { output } = run("test/fixtures/basic.html.erb", "--stats")

    expect(output).toContain("bytes (")
    expect(output).toContain("smaller)")
  })

  test("writes to the output file", () => {
    const target = "test/fixtures/tmp-output.html.erb"

    try {
      const { exitCode } = run("test/fixtures/basic.html.erb", "-o", target)

      expect(exitCode).toBe(0)
      expect(readFileSync(target, "utf-8")).toContain(`<div class="container"><h1>Hello <b>World</b></h1>`)
    } finally {
      rmSync(target, { force: true })
    }
  })

  test("overwrites the input file with --write", () => {
    const target = "test/fixtures/tmp-write.html.erb"
    const source = readFileSync("test/fixtures/basic.html.erb", "utf-8")

    try {
      writeFileSync(target, source, "utf-8")

      const { output, exitCode } = run(target, "--write")

      expect(exitCode).toBe(0)
      expect(output).toBe("")
      expect(readFileSync(target, "utf-8").length).toBeLessThan(source.length)
    } finally {
      rmSync(target, { force: true })
    }
  })

  test("exits non-zero when the template does not parse", () => {
    const { output, exitCode } = run("test/fixtures/broken.html.erb")

    expect(exitCode).toBe(1)
    expect(output).toContain("Failed")
  })

  test("shows the help message without arguments", () => {
    const { output, exitCode } = run()

    expect(exitCode).toBe(0)
    expect(output).toContain("herb-minify - Minify HTML+ERB templates")
  })
})
