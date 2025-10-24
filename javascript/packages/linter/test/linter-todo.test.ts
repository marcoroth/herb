import { beforeEach, afterEach, expect, describe, test } from "vitest"
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import YAML from "yaml"

import { LinterRule, LintOffense, LintSeverity } from "../src/types"
import { LinterTodo } from "../src/linter-todo"
import { Location } from "@herb-tools/core"

describe("LinterTodo", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "herb-test-"))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  const createOffense = (
    rule: LinterRule,
    severity: LintSeverity,
  ): LintOffense =>
    ({
      rule,
      message: "",
      severity,
      location: Location.from({
        start: { line: 1, column: 1 },
        end: { line: 1, column: 2 },
      }),
    }) as unknown as LintOffense

  describe("#generateTodoConfig", () => {
    test("generates a todo config with correct counts", () => {
      const offenses: Record<string, LintOffense[]> = {
        "src/test.html.erb": [
          createOffense("rule1", "error"),
          createOffense("rule1", "warning"),
          createOffense("rule1", "warning"),
          createOffense("rule2", "error"),
        ],
      }

      const linterTodo = new LinterTodo(tmpDir)

      linterTodo.generateTodoConfig(offenses)

      const todoContent = YAML.parse(
        readFileSync(join(tmpDir, ".herb-todo.yml"), "utf8"),
      )
      expect(todoContent).toEqual({
        excludes: {
          rule1: {
            "src/test.html.erb": {
              error: 1,
              warning: 2,
            },
          },
          rule2: {
            "src/test.html.erb": {
              error: 1,
              warning: 0,
            },
          },
        },
      })
    })
  })

  describe("#filterOffenses", () => {
    test("ignores offenses within the allowed count", () => {
      const todoConfig = {
        excludes: {
          rule1: {
            "src/test.html.erb": {
              error: 1,
              warning: 2,
            },
          },
        },
      }
      writeFileSync(join(tmpDir, ".herb-todo.yml"), YAML.stringify(todoConfig))

      const linterTodo = new LinterTodo(tmpDir)

      const offenses = [
        createOffense("rule1", "error"),
        createOffense("rule1", "warning"),
        createOffense("rule1", "warning"),
      ]

      const remaining = linterTodo.filterOffenses(
        offenses,
        "src/test.html.erb",
      )
      expect(remaining).toHaveLength(0)
    })

    test("reports offenses exceeding the allowed count", () => {
      const todoConfig = {
        excludes: {
          rule1: {
            "src/test.html.erb": {
              error: 1,
              warning: 1,
            },
          },
        },
      }
      writeFileSync(join(tmpDir, ".herb-todo.yml"), YAML.stringify(todoConfig))

      const f = new LinterTodo(tmpDir)

      const offenses = [
        createOffense("rule1", "error"),
        createOffense("rule1", "error"), // This exceeds the limit
        createOffense("rule1", "warning"),
        createOffense("rule1", "warning"), // This exceeds the limit
      ]

      const remaining = f.filterOffenses(offenses, "src/test.html.erb")
      expect(remaining).toHaveLength(2)
      expect(remaining[0].severity).toBe("error")
      expect(remaining[1].severity).toBe("warning")
    })

    test("ignores info and hint severities when generating counts", () => {
      const todoConfig = {
        excludes: {
          rule1: {
            "src/test.html.erb": {
              error: 1,
              warning: 1,
            },
          },
        },
      }
      writeFileSync(join(tmpDir, ".herb-todo.yml"), YAML.stringify(todoConfig))

      const linterTodo = new LinterTodo(tmpDir)

      const offenses = [
        createOffense("rule1", "error"),
        createOffense("rule1", "info"),
        createOffense("rule1", "hint"),
      ]

      const remaining = linterTodo.filterOffenses(
        offenses,
        "src/test.html.erb",
      )

      expect(remaining).toHaveLength(2)
      expect(remaining[0].severity).toBe("info")
      expect(remaining[1].severity).toBe("hint")
    })

    test("returns all offenses when no todo config exists", () => {
      const offenses = [
        createOffense("rule1", "error"),
        createOffense("rule1", "warning"),
      ]

      const linterTodo = new LinterTodo(tmpDir)
      const remaining = linterTodo.filterOffenses(
        offenses,
        "src/test.html.erb",
      )
      expect(remaining).toEqual(offenses)
    })
  })
})
