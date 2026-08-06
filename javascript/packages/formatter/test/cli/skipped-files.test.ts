import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFile, mkdir, rm, readFile } from "fs/promises"
import { join } from "path"

import { execBinary, expectExitCode } from "./cli-helpers"

const DIRECTORY = "test-skipped"

describe("CLI reporting for files the formatter declines to format", () => {
  const unparseable = join(DIRECTORY, "broken.html.erb")
  const unformatted = join(DIRECTORY, "unformatted.html.erb")
  const clean = join(DIRECTORY, "clean.html.erb")
  const ignored = join(DIRECTORY, "ignored.html.erb")

  const UNPARSEABLE_SOURCE = '<div><span>x\n<% if %>\n</div>\n'
  const IGNORED_SOURCE = '<%# herb:formatter ignore %>\n<div>   messy   </div>\n'

  const cleanup = async () => {
    await rm(DIRECTORY, { recursive: true }).catch(() => {})
  }

  beforeEach(async () => {
    await cleanup()
    await mkdir(DIRECTORY, { recursive: true })
  })

  afterEach(cleanup)

  it("reports a file that could not be parsed instead of counting it as clean", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)

    const result = await execBinary([DIRECTORY])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("could not be parsed")
    expect(result.stdout).toContain("broken.html.erb")
    expect(result.stdout).toContain("1 skipped")
    expect(result.stdout).toContain("1 with parse errors")
  })

  it("includes the parser error count so the file can be triaged", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)

    const result = await execBinary([DIRECTORY])

    expect(result.stdout).toMatch(/\(\d+ parser errors?\)/)
  })

  it("points at herb-lint for the actual parser errors", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)

    const result = await execBinary([DIRECTORY])

    expect(result.stdout).toContain("herb-lint")
  })

  it("leaves an unparseable file byte-identical on disk", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)

    await execBinary([DIRECTORY])

    expect(await readFile(unparseable, "utf-8")).toBe(UNPARSEABLE_SOURCE)
  })

  it("does not claim all files are properly formatted when one was skipped", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)
    await writeFile(clean, '<div>\n  <span>clean</span>\n</div>\n')

    const result = await execBinary(["--check", DIRECTORY])

    expectExitCode(result, 0)
    expect(result.stdout).not.toContain("All files are properly formatted")
    expect(result.stdout).toContain("1 skipped")
  })

  it("does not fail --check just because a file could not be parsed", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)

    const result = await execBinary(["--check", DIRECTORY])

    expectExitCode(result, 0)
  })

  it("still fails --check when a parseable file is unformatted", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)
    await writeFile(unformatted, '<div>\n<span>unformatted</span>\n</div>\n')

    const result = await execBinary(["--check", DIRECTORY])

    expectExitCode(result, 1)
    expect(result.stdout).toContain("1 unformatted")
    expect(result.stdout).toContain("1 skipped")
  })

  it("reports a herb:formatter ignore file as skipped rather than clean", async () => {
    await writeFile(ignored, IGNORED_SOURCE)

    const result = await execBinary([DIRECTORY])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("1 skipped")
    expect(result.stdout).toContain("herb:formatter ignore")
  })

  it("separates skip reasons in the summary", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)
    await writeFile(ignored, IGNORED_SOURCE)

    const result = await execBinary([DIRECTORY])

    expect(result.stdout).toContain("2 skipped")
    expect(result.stdout).toContain("1 with parse errors")
    expect(result.stdout).toContain("1 with herb:formatter ignore")
  })

  it("counts formatted, unchanged and skipped files separately", async () => {
    await writeFile(unparseable, UNPARSEABLE_SOURCE)
    await writeFile(unformatted, '<div>\n<span>unformatted</span>\n</div>\n')
    await writeFile(clean, '<div>\n  <span>clean</span>\n</div>\n')

    const result = await execBinary([DIRECTORY])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("1 formatted")
    expect(result.stdout).toContain("1 unchanged")
    expect(result.stdout).toContain("1 skipped")
    expect(result.stdout).toContain("3 total")
  })
})
