import { describe, test, expect } from "vitest"
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

  test("groups offenses into one testcase per file and rule, failing at the fail level", () => {
    const xml = formatter.render([
      offense("a.html.erb", { code: "rule-a", severity: "warning", location: Location.from(2, 0, 2, 1), message: "Warned" }),
      offense("a.html.erb", { code: "rule-a", severity: "error", location: Location.from(5, 2, 5, 3), message: "First" }),
      offense("a.html.erb", { code: "rule-a", severity: "error", location: Location.from(9, 4, 9, 5), message: "Second" }),
      offense("a.html.erb", { code: "rule-b", severity: "warning", location: Location.from(3, 0, 3, 1), message: "Only a warning" }),
    ], { files: ["a.html.erb", "clean.html.erb"], failLevel: "error" })

    expect(xml).toContain(`<testsuites name="herb-lint" tests="3" failures="1" errors="0">`)
    expect(xml).toContain(`<testcase classname="a.html.erb" name="rule-a" file="a.html.erb" line="5" time="0">`)
    expect(xml).toContain(`<failure message="First (and 1 more)" type="error">a.html.erb:2:0: warning: Warned\na.html.erb:5:2: error: First\na.html.erb:9:4: error: Second\n\nhttps://herb-tools.dev/linter/rules/rule-a</failure>`)
    expect(xml).toContain(`<testcase classname="a.html.erb" name="rule-b" file="a.html.erb" line="3" time="0">\n      <system-out>a.html.erb:3:0: warning: Only a warning</system-out>`)
    expect(xml).toContain(`<testcase classname="clean.html.erb" name="clean.html.erb" file="clean.html.erb" time="0"/>`)
  })

  test("adds a testsuite for offenses in files outside the linted file list", () => {
    const xml = formatter.render([offense("app/views/_partial.html.erb")], { files: ["app/views/index.html.erb"], failLevel: "error" })

    expect(xml).toContain(`<testsuite name="app/views/index.html.erb" tests="1" failures="0"`)
    expect(xml).toContain(`<testsuite name="app/views/_partial.html.erb" tests="1" failures="1"`)
  })

  test("escapes XML and strips terminal colors, hyperlinks and characters XML can't represent", () => {
    const message = `Use \u001B[36m<span class="a">\u001B[0m & \u001B]8;;https://example.com\u001B\\'link'\u001B]8;;\u001B\\\u0000here`
    const xml = formatter.render([offense("a.html.erb", { message })], { files: ["a.html.erb"], failLevel: "error" })

    expect(xml).toContain(`message="Use &lt;span class=&quot;a&quot;&gt; &amp; &apos;link&apos;here"`)
    expect(xml).not.toContain("\u001B")
    expect(xml).not.toContain("[36m")
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
    const xml = formatter.renderSkipped("Linter is disabled in .herb.yml configuration.")

    expect(xml).toContain(`<testsuites name="herb-lint" tests="1" failures="0" errors="0" skipped="1">`)
    expect(xml).toContain(`<skipped message="Linter is disabled in .herb.yml configuration.">Linter is disabled in .herb.yml configuration.</skipped>`)
  })
})
