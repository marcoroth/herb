import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"

import { afterEach, describe, expect, test } from "vitest"
import type { JSONOutput } from "../src/cli/formatters/json-formatter.js"

const projects: string[] = []
const RULE = "a11y-avoid-generic-link-text"
const TEMPLATE = "app/views/guides/index.html.erb"

function project(
  source: string,
  framework: string | null = "actionview",
  rules = `${RULE}:\n      enabled: true`,
): string {
  const root = mkdtempSync(join(tmpdir(), "herb-cli-helpers-"))
  projects.push(root)

  mkdirSync(dirname(join(root, TEMPLATE)), { recursive: true })
  writeFileSync(join(root, TEMPLATE), source + "\n")
  writeFileSync(
    join(root, ".herb.yml"),
    [
      ...(framework ? [`framework: ${framework}`] : []),
      "linter:",
      "  rules:",
      "    all:",
      "      enabled: false",
      `    ${rules}`,
      "",
    ].join("\n"),
  )

  return root
}

function runLinter(root: string, ...args: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      resolve("bin/herb-lint"),
      "--json",
      "--no-timing",
      "--fail-level",
      "warning",
      ...args,
    ],
    {
      cwd: root,
      encoding: "utf-8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: undefined,
        GITHUB_ACTIONS: undefined,
      },
    },
  )

  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  expect(result.stderr).toBe("")

  const output: JSONOutput = JSON.parse(result.stdout)
  expect(output.completed).toBe(true)

  return { output, exitCode: result.status }
}

function expectGenericLink(source: string) {
  const root = project(source)
  const { output, exitCode } = runLinter(root)

  expect(exitCode).toBe(1)
  expect(output.clean).toBe(false)
  expect(output.offenses).toHaveLength(1)
  expect(output.offenses[0]).toMatchObject({
    filename: join(root, TEMPLATE),
    code: RULE,
    severity: "warning",
    message: expect.stringContaining("Avoid using generic link text"),
    location: { start: { line: 1 } },
  })
  expect(output.summary).toMatchObject({
    filesChecked: 1,
    totalWarnings: 1,
    totalErrors: 0,
  })
}

afterEach(() => {
  for (const root of projects.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("CLI Action View helper analysis", () => {
  test.each(["read more", "learn more", "click here", "more", "link", "here"])(
    "reports the generic label %s in helpers and HTML",
    (label) => {
      expectGenericLink(`<%= link_to "${label}", "/guide" %>`)
      expectGenericLink(`<a href="/guide">${label}</a>`)
    },
  )

  test.each([
    "LEARN MORE",
    "  Read   more!  ",
    "Click-here...",
    "(More)",
    "LINK!",
    "Here?",
  ])("normalizes case, whitespace and punctuation in %s", (label) => {
    expectGenericLink(`<%= link_to "${label}", "/guide" %>`)
    expectGenericLink(`<a href="/guide">${label}</a>`)
  })

  test.each([
    `<%= self.link_to "Learn more", "/guide" %>`,
    `<%= helpers.link_to "Learn more", "/guide" %>`,
    `<% if show_guide? %><%= link_to "Learn more", "/guide" %><% end %>`,
    `<%= link_to "Learn more", "/guide" if show_guide? %>`,
    `<%= link_to "Learn more", "/guide" unless hide_guide? %>`,
    `<%= link_to "/guide" do %>Read more<% end %>`,
    `<%= tag.a "Learn more", href: "/guide" %>`,
    `<%= content_tag :a, "Learn more", href: "/guide" %>`,
  ])("reports supported helper form %s", (source) => {
    expectGenericLink(source)
  })

  test.each([
    `<%= link_to "Learn more about the guide", "/guide" %>`,
    `<%= link_to "/guide" do %>Read the guide<% end %>`,
    `<a href="/guide">Read the guide</a>`,
    `<%= link_to label, "/guide" %>`,
    `<%= link_to t(".learn_more"), "/guide" %>`,
    `<%= link_to "Learn more about #{topic}", "/guide" %>`,
    `<%= link_to "/guide" do %><%= t(".learn_more") %><% end %>`,
    `<a href="/guide"><%= label %></a>`,
    `<%# link_to "Learn more", "/guide" %>`,
    `<%= link_to "Learn more", "/guide", "aria-label": "Read the guide" %>`,
    `<%= link_to "Learn more", "/guide", aria: { label: "Read the guide" } %>`,
    `<%= link_to "Learn more", "/guide", aria: { label: label } %>`,
    `<%= link_to "Learn more", "/guide", "aria-labelledby": "guide-title" %>`,
    `<%= link_to "Learn more", "/guide", aria: { labelledby: "guide-title" } %>`,
    `<%= link_to "/guide", aria: { label: "Read the guide" } do %>Learn more<% end %>`,
    `<a href="/guide" aria-label="Read the guide">Learn more</a>`,
    `<a href="/guide" aria-label="<%= label %>">Learn more</a>`,
    `<a href="/guide" aria-labelledby="guide-title">Learn more</a>`,
  ])("keeps exemptions clean: %s", (source) => {
    const { output, exitCode } = runLinter(project(source))

    expect(exitCode).toBe(0)
    expect(output.clean).toBe(true)
    expect(output.offenses).toEqual([])
  })

  test.each(["ruby", "hanami", "sinatra", null])(
    "does not assume Action View for framework %s",
    (framework) => {
      const root = project(
        `<%= link_to "Learn more", "/guide" %>\n<a href="/guide">Learn more</a>`,
        framework,
      )
      if (framework === null) {
        writeFileSync(join(root, "Gemfile"), `gem "rails"\n`)
        mkdirSync(join(root, "config"))
        writeFileSync(
          join(root, "config/application.rb"),
          `require "rails/all"\n`,
        )
      }
      const { output, exitCode } = runLinter(root)

      expect(exitCode).toBe(1)
      expect(output.offenses).toHaveLength(1)
      expect(output.offenses[0]).toMatchObject({
        code: RULE,
        location: { start: { line: 2 } },
      })
    },
  )

  test("respects explicit rule disabling in an Action View project", () => {
    const root = project(
      `<%= link_to "Learn more", "/guide" %>`,
      "actionview",
      `${RULE}:\n      enabled: false`,
    )
    const { output, exitCode } = runLinter(root)

    expect(exitCode).toBe(0)
    expect(output.offenses).toEqual([])
  })

  test("loads framework from an explicitly selected config file", () => {
    const root = project(`<%= link_to "Learn more", "/guide" %>`, "ruby")
    writeFileSync(
      join(root, "actionview.herb.yml"),
      `framework: actionview\nlinter:\n  rules:\n    all:\n      enabled: false\n    ${RULE}:\n      enabled: true\n`,
    )
    const { output, exitCode } = runLinter(
      root,
      "--config-file",
      "actionview.herb.yml",
    )

    expect(exitCode).toBe(1)
    expect(output.offenses).toHaveLength(1)
    expect(output.offenses[0].code).toBe(RULE)
  })

  test.each([
    `<%= link_to "Learn more", "/guide" %> <%# herb:disable a11y-avoid-generic-link-text %>`,
    `<%# herb:linter ignore %>\n<%= link_to "Learn more", "/guide" %>`,
  ])("respects suppression: %s", (source) => {
    const { output, exitCode } = runLinter(project(source))

    expect(exitCode).toBe(0)
    expect(output.offenses).toEqual([])
  })

  test("can ignore a helper's disable comment", () => {
    const root = project(
      `<%= link_to "Learn more", "/guide" %> <%# herb:disable a11y-avoid-generic-link-text %>`,
    )
    const suppressed = runLinter(root)
    expect(suppressed.output.summary?.totalIgnored).toBe(1)

    const { output, exitCode } = runLinter(root, "--ignore-disable-comments")
    expect(exitCode).toBe(1)
    expect(output.offenses).toHaveLength(1)
    expect(output.offenses[0].code).toBe(RULE)
  })

  test.each(["1", "2"])(
    "propagates framework through file processing with %s jobs",
    (jobs) => {
      const root = project(`<%= link_to "Learn more", "/guide" %>`)
      for (let index = 1; index < 10; index++) {
        writeFileSync(
          join(root, `app/views/guides/page${index}.html.erb`),
          `<%= link_to "Learn more", "/guide" %>\n`,
        )
      }
      const { output, exitCode } = runLinter(root, "--jobs", jobs)

      expect(exitCode).toBe(1)
      expect(output.offenses).toHaveLength(10)
      expect(output.offenses.every((offense) => offense.code === RULE)).toBe(
        true,
      )
      expect(output.summary).toMatchObject({
        filesChecked: 10,
        totalWarnings: 10,
      })
    },
  )

  test("propagates framework to other helper-aware rules", () => {
    const root = project(
      `<%= image_tag "/guide.png" %>`,
      "actionview",
      "html-img-require-alt:\n      enabled: true",
    )
    const { output, exitCode } = runLinter(root)

    expect(exitCode).toBe(1)
    expect(output.offenses).toHaveLength(1)
    expect(output.offenses[0].code).toBe("html-img-require-alt")
  })
})
