import { describe, test, expect } from "vitest"

import { BaseFormatter } from "../../src/cli/formatters/base-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../../src/cli/file-processor.js"

class TestFormatter extends BaseFormatter {
  async format(): Promise<void> {}
  formatFile(): void {}

  read(processedFile: ProcessedFile): string {
    return this.contentFor(processedFile)
  }
}

describe("BaseFormatter", () => {
  const offense = {} as Diagnostic

  test("reads the file from disk when the offense has no content", () => {
    const formatter = new TestFormatter()

    const content = formatter.read({
      filename: "test/fixtures/bad-file.html.erb",
      offense
    })

    expect(content).toContain("<SPAN>Bad file</SPAN>")
  })

  test("resolves filenames against the project path", () => {
    const formatter = new TestFormatter(`${process.cwd()}/test/fixtures`)

    const content = formatter.read({
      filename: "bad-file.html.erb",
      offense
    })

    expect(content).toContain("<SPAN>Bad file</SPAN>")
  })

  test("prefers content provided on the offense", () => {
    const formatter = new TestFormatter()

    const content = formatter.read({
      filename: "test/fixtures/bad-file.html.erb",
      offense,
      content: "<div>provided</div>"
    })

    expect(content).toBe("<div>provided</div>")
  })

  test("returns an empty string for unreadable files", () => {
    const formatter = new TestFormatter()

    const content = formatter.read({
      filename: "test/fixtures/does-not-exist.html.erb",
      offense
    })

    expect(content).toBe("")
  })

  test("reads each file once when offenses are grouped by file", () => {
    const formatter = new TestFormatter()

    const first = formatter.read({ filename: "test/fixtures/bad-file.html.erb", offense })
    const second = formatter.read({ filename: "test/fixtures/bad-file.html.erb", offense })
    const other = formatter.read({ filename: "test/fixtures/test-file-simple.html.erb", offense })

    expect(second).toBe(first)
    expect(other).not.toBe(first)
  })
})
