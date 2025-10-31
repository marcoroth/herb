import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src/linter.js"
import { Config } from "@herb-tools/config"

describe("Rule-level include/only/exclude patterns", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const testDir = "/test/project"

  describe("rule.include pattern", () => {
    test("applies rule only to files matching include pattern", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)

      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result1.offenses.length).toBeGreaterThan(0)
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })

    test("applies rule to files matching any of multiple include patterns", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*", "app/partials/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/partials/header.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result3 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })

    test("respects both include and exclude patterns", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*"],
              exclude: ["app/components/legacy/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/components/legacy/old.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)

      const result3 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })
  })

  describe("rule.only pattern", () => {
    test("restricts rule to only files matching pattern", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              only: ["app/views/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })

    test("only pattern overrides include pattern", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*"],
              only: ["app/views/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })

    test("exclude still applies even with only pattern", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              only: ["app/views/**/*"],
              exclude: ["app/views/admin/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/admin/users.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)

      const result3 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })
  })

  describe("rule.exclude pattern", () => {
    test("excludes files from rule without include/only", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              exclude: ["app/views/legacy/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/legacy/old.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
    })
  })

  describe("complex scenarios", () => {
    test("different rules can have different patterns", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*"]
            },
            "html-img-require-alt": {
              only: ["app/views/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = '<SPAN><img src="test.jpg"></SPAN>'

      const result1 = linter.lint(source, { fileName: "app/components/card.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)
      expect(result1.offenses.some(offense => offense.rule === "html-img-require-alt")).toBe(false)

      const result2 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(false)
      expect(result2.offenses.some(offense => offense.rule === "html-img-require-alt")).toBe(true)
    })

    test("rule patterns work with linter-level exclude", () => {
      const config = Config.fromObject({
        linter: {
          exclude: ["vendor/**/*"],
          rules: {
            "html-tag-name-lowercase": {
              include: ["app/components/**/*"]
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "vendor/bundle/file.html.erb" })
      expect(result2.offenses.length).toBe(0)
    })

    test("no patterns means rule applies to all files", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              // no config
            }
          }
        }
      }, { projectPath: testDir })

      const linter = Linter.from(Herb, config)
      const source = "<SPAN>Test</SPAN>"

      const result1 = linter.lint(source, { fileName: "app/components/button.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)

      const result3 = linter.lint(source, { fileName: "lib/templates/email.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)
    })
  })
})
