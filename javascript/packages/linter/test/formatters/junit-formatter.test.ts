import { describe, test, expect } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@herb-tools/core"

import { JUnitFormatter } from "../../src/cli/formatters/junit-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../../src/cli/file-processor.js"

describe("JUnitFormatter", () => {
  const formatter = new JUnitFormatter()

  function offense(filename: string, overrides: Partial<Diagnostic> = {}): ProcessedFile {
    return {
      filename,
      offense: {
        message: "Test message",
        location: Location.from(1, 0, 1, 5),
        severity: "error",
        code: "test-rule",
        source: "Herb Linter",
        ...overrides
      } as Diagnostic
    }
  }

  test.each(["error", "warning"] as const)("reports each offense separately with fail level %s", (failLevel) => {
    const xml = formatter.render([
      offense("a.html.erb", { code: "rule-a", severity: "warning", location: Location.from(2, 0, 2, 1), message: "Warned" }),
      offense("a.html.erb", { code: "rule-a", severity: "error", location: Location.from(5, 2, 5, 3), message: "First" }),
      offense("a.html.erb", { code: "rule-a", severity: "error", location: Location.from(5, 4, 5, 5), message: "Second" }),
      offense("a.html.erb", { code: "rule-b", severity: "warning", location: Location.from(3, 0, 3, 1), message: "Only a warning" }),
    ], { files: ["a.html.erb", "clean.html.erb"], failLevel })

    expect(xml).toMatchSnapshot()
  })

  test("distinguishes offenses at the same rule and location without changing other names", () => {
    const xml = formatter.render([
      offense("a.html.erb", { message: "First" }),
      offense("a.html.erb", { message: "Warning", severity: "warning" }),
      offense("a.html.erb", { message: "Third" }),
      offense("a.html.erb", { code: "other-rule", message: "Other rule" }),
      offense("b.html.erb", { message: "Other file" }),
    ], { files: ["a.html.erb", "b.html.erb"], failLevel: "error" })

    expect([...xml.matchAll(/<testcase classname="([^"]+)" name="([^"]+)"/g)].map(([, file, name]) => [file, name])).toEqual([
      ["a.html.erb", "test-rule:1:0"],
      ["a.html.erb", "test-rule:1:0#2"],
      ["a.html.erb", "test-rule:1:0#3"],
      ["a.html.erb", "other-rule:1:0"],
      ["b.html.erb", "test-rule:1:0"],
    ])
    expect(xml).toMatchSnapshot()
  })

  test("keeps report paths and source frames consistent across checkout roots and invocation styles", () => {
    const directory = mkdtempSync(join(tmpdir(), "herb-junit-"))
    const reports: string[] = []

    try {
      for (const checkout of ["agent-one", "agent-two"]) {
        const projectPath = join(directory, checkout)
        mkdirSync(join(projectPath, "app", "views"), { recursive: true })
        writeFileSync(join(projectPath, "app/views/profile.html.erb"), "<img>\n")

        for (const absolute of [false, true]) {
          const filename = absolute ? join(projectPath, "app/views/profile.html.erb") : "app/views/profile.html.erb"
          const cleanFile = absolute ? join(projectPath, "app/views/clean.html.erb") : "app/views/clean.html.erb"
          reports.push(formatter.render([offense(filename)], { files: [filename, cleanFile], failLevel: "error", projectPath }))
        }
      }

      expect(new Set(reports).size).toBe(1)
      expect(reports[0]).toMatchSnapshot()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("adds a testsuite for offenses in files outside the linted file list", () => {
    const xml = formatter.render([offense("app/views/_partial.html.erb")], { files: ["app/views/index.html.erb"], failLevel: "error" })

    expect(xml).toMatchSnapshot()
  })

  test("escapes XML and strips terminal colors, hyperlinks and characters XML can't represent", () => {
    const message = `Use \u001B[36m<span class="a">\u001B[0m & \u001B]8;;https://example.com\u001B\\'link'\u001B]8;;\u001B\\\u0000here\uD800😀\uDFFF`
    const xml = formatter.render([offense("a.html.erb", { message })], { files: ["a.html.erb"], failLevel: "error" })

    expect(xml).toMatchSnapshot()
  })

  test("preserves tabs and line breaks in attribute values instead of normalizing them to spaces", () => {
    const files = ["views/a\tb.html.erb", "views/a\nb.html.erb", "views/a\rb.html.erb", "views/a b.html.erb"]

    expect(formatter.render([offense(files[0])], { files, failLevel: "error" })).toMatchSnapshot()

    const message = 'Problem:\t<&>\n"quoted"\r&#10;'
    const attribute = 'Problem:&#9;&lt;&amp;&gt;&#10;&quot;quoted&quot;&#13;&amp;#10;'
    const body = 'Problem:\t&lt;&amp;&gt;\n&quot;quoted&quot;\r&amp;#10;'

    expect(formatter.renderError(message)).toBe([
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<testsuites name="herb-lint" tests="1" failures="0" errors="1" skipped="0">`,
      `  <testsuite name="herb-lint" tests="1" failures="0" errors="1" skipped="0" time="0">`,
      `    <testcase classname="herb-lint" name="herb-lint" time="0">`,
      `      <error message="${attribute}">${body}</error>`,
      `    </testcase>`,
      `  </testsuite>`,
      `</testsuites>`,
    ].join("\n"))

    expect(formatter.renderSkipped(message)).toBe([
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<testsuites name="herb-lint" tests="1" failures="0" errors="0" skipped="1">`,
      `  <testsuite name="herb-lint" tests="1" failures="0" errors="0" skipped="1" time="0">`,
      `    <testcase classname="herb-lint" name="herb-lint" time="0">`,
      `      <skipped message="${attribute}">${body}</skipped>`,
      `    </testcase>`,
      `  </testsuite>`,
      `</testsuites>`,
    ].join("\n"))
  })

  test("includes XML-escaped source context and marks each offense independently", () => {
    const content = [
      "<h1>Your profile</h1>",
      '<img src="/avatar.png?size=small&shape=square">',
      "<p>Company</p>",
      '<img src="/company-logo.png">',
    ].join("\n")
    const xml = formatter.render([2, 4].map(line => ({
      ...offense("profile.html.erb", { location: Location.from(line, 1, line, 4) }),
      content,
    })), { files: ["profile.html.erb"], failLevel: "error" })

    expect(xml).toMatchSnapshot()
  })

  test("renders an error as a single erroring testcase with the message in its body", () => {
    expect(formatter.renderError("✗ Unknown rule \u001B[36mfoo\u001B[39m passed to --only.")).toBe([
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<testsuites name="herb-lint" tests="1" failures="0" errors="1" skipped="0">`,
      `  <testsuite name="herb-lint" tests="1" failures="0" errors="1" skipped="0" time="0">`,
      `    <testcase classname="herb-lint" name="herb-lint" time="0">`,
      `      <error message="✗ Unknown rule foo passed to --only.">✗ Unknown rule foo passed to --only.</error>`,
      `    </testcase>`,
      `  </testsuite>`,
      `</testsuites>`,
    ].join("\n"))
  })

  test("renders a run with nothing to lint as a single skipped testcase", () => {
    expect(formatter.renderSkipped("Linter is disabled in .herb.yml configuration.")).toMatchSnapshot()
  })
})
