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

    const failures = failLevel === "error" ? 2 : 4

    expect(xml).toContain(`<testsuites name="herb-lint" tests="5" failures="${failures}" errors="0">`)
    expect(xml).toContain(`<testsuite name="a.html.erb" tests="4" failures="${failures}"`)
    expect(xml).toContain(`<testcase classname="a.html.erb" name="rule-a:5:2" file="a.html.erb" line="5" time="0">\n      <failure type="error">First\n\na.html.erb:5:2\n\nhttps://herb-tools.dev/linter/rules/rule-a</failure>`)
    expect(xml).toContain(`<testcase classname="a.html.erb" name="rule-a:5:4" file="a.html.erb" line="5" time="0">\n      <failure type="error">Second\n\na.html.erb:5:4\n\nhttps://herb-tools.dev/linter/rules/rule-a</failure>`)
    expect(xml).toContain(`name="rule-a:2:0"`)
    expect(xml).toContain(`name="rule-b:3:0"`)

    if (failLevel === "error") {
      expect(xml).toContain(`<system-out>a.html.erb:2:0: warning: Warned</system-out>`)
      expect(xml).toContain(`<system-out>a.html.erb:3:0: warning: Only a warning</system-out>`)
    } else {
      expect(xml).not.toContain("<system-out>")
      expect(xml).toContain(`<failure type="warning">Warned\n\n`)
      expect(xml).toContain(`<failure type="warning">Only a warning\n\n`)
    }

    expect(xml).toContain(`<testcase classname="clean.html.erb" name="clean.html.erb" file="clean.html.erb" time="0"/>`)
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
    expect(xml).toContain('tests="5" failures="4" errors="0"')
    for (const message of ["First", "Third", "Other rule", "Other file"]) {
      expect(xml).toContain(`<failure type="error">${message}\n\n`)
    }
    expect(xml).toContain("<system-out>a.html.erb:1:0: warning: Warning</system-out>")
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
          const xml = formatter.render([offense(filename)], { files: [filename, cleanFile], failLevel: "error", projectPath })

          expect(xml).not.toContain(directory)
          expect(xml).toContain('<testsuite name="app/views/profile.html.erb"')
          expect(xml).toContain('<testcase classname="app/views/profile.html.erb" name="test-rule:1:0" file="app/views/profile.html.erb"')
          expect(xml).toContain('<testcase classname="app/views/clean.html.erb" name="app/views/clean.html.erb" file="app/views/clean.html.erb"')
          expect(xml).toContain("app/views/profile.html.erb:1:0")
          expect(xml).toContain("→   1 │ &lt;img&gt;")
          reports.push(xml)
        }
      }

      expect(new Set(reports).size).toBe(1)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("adds a testsuite for offenses in files outside the linted file list", () => {
    const xml = formatter.render([offense("app/views/_partial.html.erb")], { files: ["app/views/index.html.erb"], failLevel: "error" })

    expect(xml).toContain(`<testsuite name="app/views/index.html.erb" tests="1" failures="0"`)
    expect(xml).toContain(`<testsuite name="app/views/_partial.html.erb" tests="1" failures="1"`)
  })

  test("escapes XML and strips terminal colors, hyperlinks and characters XML can't represent", () => {
    const message = `Use \u001B[36m<span class="a">\u001B[0m & \u001B]8;;https://example.com\u001B\\'link'\u001B]8;;\u001B\\\u0000here\uD800😀\uDFFF`
    const xml = formatter.render([offense("a.html.erb", { message })], { files: ["a.html.erb"], failLevel: "error" })

    expect(xml).toContain(`<failure type="error">Use &lt;span class=&quot;a&quot;&gt; &amp; &#39;link&#39;here😀\n\n`)
    expect(xml).not.toContain("\u001B")
    expect(xml).not.toContain("[36m")
  })

  test("preserves tabs and line breaks in attribute values instead of normalizing them to spaces", () => {
    const paths = [
      ["views/a\tb.html.erb", "views/a&#9;b.html.erb"],
      ["views/a\nb.html.erb", "views/a&#10;b.html.erb"],
      ["views/a\rb.html.erb", "views/a&#13;b.html.erb"],
      ["views/a b.html.erb", "views/a b.html.erb"],
    ]
    const files = paths.map(([filename]) => filename)
    const xml = formatter.render([offense(files[0])], { files, failLevel: "error" })

    for (const [, escaped] of paths) {
      expect(xml).toContain(`<testsuite name="${escaped}"`)
      expect(xml).toContain(`<testcase classname="${escaped}"`)
      expect(xml).toContain(`file="${escaped}"`)
    }
    expect(xml).toContain('name="views/a&#10;b.html.erb" file="views/a&#10;b.html.erb"')

    const message = 'Problem:\t<&>\n"quoted"\r&#10;'
    const attribute = 'Problem:&#9;&lt;&amp;&gt;&#10;&quot;quoted&quot;&#13;&amp;#10;'
    const body = 'Problem:\t&lt;&amp;&gt;\n&quot;quoted&quot;\r&amp;#10;'

    expect(formatter.renderError(message)).toContain(`<error message="${attribute}">${body}</error>`)
    expect(formatter.renderSkipped(message)).toContain(`<skipped message="${attribute}">${body}</skipped>`)
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

    const failures = [...xml.matchAll(/<failure[^>]*>([\s\S]*?)<\/failure>/g)].map(match => match[1])

    expect(failures).toHaveLength(2)
    expect(xml).not.toContain('message="')
    for (const body of failures) {
      expect(body).toMatch(/^Test message\n\nprofile\.html\.erb:/)
      expect(body.match(/Test message/g)).toHaveLength(1)
    }
    expect(failures[0]).toContain('→   2 │ &lt;img src=&quot;/avatar.png?size=small&amp;shape=square&quot;&gt;')
    expect(failures[0]).not.toContain("→   4 │")
    expect(failures[1]).toContain('→   4 │ &lt;img src=&quot;/company-logo.png&quot;&gt;')
    expect(failures[1]).not.toContain("→   2 │")
    expect(failures[0]).toContain("1 │ &lt;h1&gt;Your profile&lt;/h1&gt;")
    expect(failures[0]).toContain("│  ~~~")
    expect(xml).not.toContain("<img")
    expect(xml).not.toContain("\u001B")
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
