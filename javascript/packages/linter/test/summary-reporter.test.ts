import { afterEach, describe, expect, test, vi } from "vitest"

import { SummaryReporter } from "../src/cli/summary-reporter.js"

import type { SummaryData } from "../src/cli/summary-reporter.js"

describe("SummaryReporter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("keeps the space before a version label inside its color sequence", () => {
    const originalNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR

    const log = vi.spyOn(console, "log").mockImplementation(() => {})

    try {
      new SummaryReporter().displayVersionSkippedRules({
        rulesSkippedByVersion: [
          { ruleName: "html-example", introducedIn: "0.10.3" },
        ],
        configVersion: "0.10.3",
        hasConfigFile: true,
      } as SummaryData)

      const ruleLine = log.mock.calls
        .map(([line]) => line)
        .find(
          (line) => typeof line === "string" && line.includes("html-example"),
        )

      expect(ruleLine).toMatch(
        /\x1b\\\x1b\[[0-9;]+m \(introduced in 0\.10\.3\)/,
      )
    } finally {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR
      } else {
        process.env.NO_COLOR = originalNoColor
      }
    }
  })
})
