import dedent from "dedent"
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { Config } from "../src/config.js"
import type { HerbConfigOptions } from "../src/config.js"

function createTestFile(dir: string, relativePath: string, content: string = "") {
  const fullPath = join(dir, relativePath)
  const dirPath = join(fullPath, "..")
  mkdirSync(dirPath, { recursive: true })
  writeFileSync(fullPath, content)
  return fullPath
}

describe("@herb-tools/config", () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `herb-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("Config class", () => {
    test("is defined", () => {
      expect(Config).toBeDefined()
    })

    test("can be instantiated", () => {
      const config = new Config(testDir, { version: "0.8.8" })
      expect(config).toBeInstanceOf(Config)
    })

    test("sets correct config path", () => {
      const config = new Config(testDir, { version: "0.8.8" })
      expect(config.path).toBe(join(testDir, ".herb.yml"))
    })
  })

  describe("Config.configPathFromProjectPath", () => {
    test("returns correct path for project directory", () => {
      const configPath = Config.configPathFromProjectPath(testDir)
      expect(configPath).toBe(join(testDir, ".herb.yml"))
    })

    test("appends .herb.yml to any path (including explicit .herb.yml)", () => {
      const herbYmlPath = join(testDir, ".herb.yml")
      const configPath = Config.configPathFromProjectPath(herbYmlPath)

      expect(configPath).toBe(join(herbYmlPath, ".herb.yml"))
    })
  })

  describe("Config.exists", () => {
    test("returns false when config file does not exist", () => {
      expect(Config.exists(testDir)).toBe(false)
    })

    test("returns true when config file exists", () => {
      const configPath = join(testDir, ".herb.yml")
      writeFileSync(configPath, "version: 0.8.8\n")

      expect(Config.exists(testDir)).toBe(true)
    })

    test("handles explicit .herb.yml path", () => {
      const configPath = join(testDir, ".herb.yml")
      writeFileSync(configPath, "version: 0.8.8\n")

      expect(Config.exists(configPath)).toBe(true)
    })
  })

  describe("Config.readRawYaml", () => {
    test("reads raw YAML content from config file", () => {
      const configPath = join(testDir, ".herb.yml")
      const yamlContent = dedent`
        version: 0.8.8
        linter:
          enabled: true
          rules:
            html-tag-name-lowercase:
              enabled: false
      `
      writeFileSync(configPath, yamlContent)

      const rawYaml = Config.readRawYaml(testDir)
      expect(rawYaml).toBe(yamlContent)
    })

    test("handles explicit .herb.yml path", () => {
      const configPath = join(testDir, ".herb.yml")
      const yamlContent = "version: 0.8.8\n"
      writeFileSync(configPath, yamlContent)

      const rawYaml = Config.readRawYaml(configPath)
      expect(rawYaml).toBe(yamlContent)
    })
  })

  describe("Config.fromObject", () => {
    test("creates config from empty object", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config).toBeInstanceOf(Config)
      expect(config.config.version).toBeDefined()
    })

    test("creates config with linter settings", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          enabled: true,
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }

      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.config.linter?.enabled).toBe(true)
      expect(config.config.linter?.rules?.["html-tag-name-lowercase"]?.enabled).toBe(false)
    })

    test("creates config with formatter settings", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: true,
          indentWidth: 4,
          maxLineLength: 120
        }
      }

      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.config.formatter?.enabled).toBe(true)
      expect(config.config.formatter?.indentWidth).toBe(4)
      expect(config.config.formatter?.maxLineLength).toBe(120)
    })

    test("uses custom version when provided", () => {
      const config = Config.fromObject({}, { projectPath: testDir, version: "1.0.0" })

      expect(config.config.version).toBe("1.0.0")
    })
  })

  describe("Config.createConfigYamlString", () => {
    test("creates YAML string from config mutation", () => {
      const mutation: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }

      const yamlString = Config.createConfigYamlString(mutation)

      expect(yamlString).toContain("version:")
      expect(yamlString).toContain("linter:")
      expect(yamlString).toContain("rules:")
      expect(yamlString).toContain("html-tag-name-lowercase:")
      expect(yamlString).toContain("enabled: false")
    })

    test("creates YAML string with formatter config", () => {
      const mutation: HerbConfigOptions = {
        formatter: {
          enabled: true,
          indentWidth: 4
        }
      }

      const yamlString = Config.createConfigYamlString(mutation)

      expect(yamlString).toContain("formatter:")
      expect(yamlString).toContain("enabled: true")
      expect(yamlString).toContain("indentWidth: 4")
    })
  })

  describe("Config.applyMutationToYamlString", () => {
    test("applies mutation to existing YAML", () => {
      const existingYaml = dedent`
        version: 0.8.8
        linter:
          enabled: true
      `

      const mutation: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }

      const updatedYaml = Config.applyMutationToYamlString(existingYaml, mutation)

      expect(updatedYaml).toContain("version: 0.8.8")
      expect(updatedYaml).toContain("enabled: true")
      expect(updatedYaml).toContain("html-tag-name-lowercase:")
      expect(updatedYaml).toContain("enabled: false")
    })

    test("merges rules without overwriting existing rules", () => {
      const existingYaml = dedent`
        version: 0.8.8
        linter:
          rules:
            html-img-require-alt:
              enabled: false
      `

      const mutation: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }

      const updatedYaml = Config.applyMutationToYamlString(existingYaml, mutation)

      expect(updatedYaml).toContain("html-img-require-alt:")
      expect(updatedYaml).toContain("html-tag-name-lowercase:")
    })

    test("updates existing rule configuration", () => {
      const existingYaml = dedent`
        version: 0.8.8
        linter:
          rules:
            html-tag-name-lowercase:
              enabled: true
              severity: error
      `

      const mutation: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }

      const updatedYaml = Config.applyMutationToYamlString(existingYaml, mutation)

      expect(updatedYaml).toContain("html-tag-name-lowercase:")
      expect(updatedYaml).toContain("enabled: false")
      expect(updatedYaml).toContain("severity: error")
    })
  })

  describe("Config instance methods", () => {
    test("toJSON returns JSON string of config", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          enabled: true
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const jsonString = config.toJSON()

      expect(typeof jsonString).toBe("string")
      const parsed = JSON.parse(jsonString)
      expect(parsed).toHaveProperty("version")
      expect(parsed).toHaveProperty("linter")
      expect(parsed.linter).toHaveProperty("enabled", true)
    })

    test("getConfiguredSeverity returns default severity when not configured", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      const severity = config.getConfiguredSeverity("some-rule", "warning")

      expect(severity).toBe("warning")
    })

    test("getConfiguredSeverity returns configured severity", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              severity: "error"
            }
          }
        }
      }

      const config = Config.fromObject(configOptions, { projectPath: testDir })
      const severity = config.getConfiguredSeverity("html-tag-name-lowercase", "warning")

      expect(severity).toBe("error")
    })

    test("applySeverityOverrides applies configured severities to offenses", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "rule-1": { severity: "error" },
            "rule-2": { severity: "hint" }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const offenses = [
        { rule: "rule-1", severity: "warning" as const, message: "test" },
        { rule: "rule-2", severity: "warning" as const, message: "test" },
        { rule: "rule-3", severity: "warning" as const, message: "test" }
      ]

      const updated = config.applySeverityOverrides(offenses)

      expect(updated[0].severity).toBe("error")
      expect(updated[1].severity).toBe("hint")
      expect(updated[2].severity).toBe("warning")
    })

    test("isLinterEnabled returns true when linter is enabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          enabled: true
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isLinterEnabled).toBe(true)
    })

    test("isLinterEnabled returns false when linter is disabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          enabled: false
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isLinterEnabled).toBe(false)
    })

    test("isLinterEnabled returns true by default", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isLinterEnabled).toBe(true)
    })

    test("isFormatterEnabled returns true when formatter is enabled", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: true
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isFormatterEnabled).toBe(true)
    })

    test("isFormatterEnabled returns false when formatter is disabled", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: false
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isFormatterEnabled).toBe(false)
    })

    test("isFormatterEnabled returns false by default", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isFormatterEnabled).toBe(false)
    })

    test("isRuleDisabled returns true when rule is disabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleDisabled("html-tag-name-lowercase")).toBe(true)
    })

    test("isRuleDisabled returns false when rule is enabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: true }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleDisabled("html-tag-name-lowercase")).toBe(false)
    })

    test("isRuleDisabled returns false when rule is not configured", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isRuleDisabled("html-tag-name-lowercase")).toBe(false)
    })

    test("isRuleEnabled returns false when rule is disabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabled("html-tag-name-lowercase")).toBe(false)
    })

    test("isRuleEnabled returns true when rule is enabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: true }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabled("html-tag-name-lowercase")).toBe(true)
    })

    test("isRuleEnabled returns true when rule is not configured", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isRuleEnabled("html-tag-name-lowercase")).toBe(true)
    })

    test("isLinterEnabledForPath returns true when no exclude patterns", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isLinterEnabledForPath("app/views/home/index.html.erb")).toBe(true)
    })

    test("isLinterEnabledForPath returns false when path matches exclude pattern", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isLinterEnabledForPath("vendor/bundle/some_gem/file.html.erb")).toBe(false)
    })

    test("isLinterEnabledForPath returns true when path does not match exclude pattern", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isLinterEnabledForPath("app/views/home/index.html.erb")).toBe(true)
    })

    test("isLinterEnabledForPath returns false when linter is disabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          enabled: false
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isLinterEnabledForPath("app/views/home/index.html.erb")).toBe(false)
    })

    test("isFormatterEnabledForPath returns true when no exclude patterns", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: true
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isFormatterEnabledForPath("app/views/home/index.html.erb")).toBe(true)
    })

    test("isFormatterEnabledForPath returns false when path matches exclude pattern", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: true,
          exclude: ["test/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isFormatterEnabledForPath("test/fixtures/sample.html.erb")).toBe(false)
    })

    test("isFormatterEnabledForPath returns false when formatter is disabled", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: false
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isFormatterEnabledForPath("app/views/home/index.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath returns true when no exclude patterns", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(true)
    })

    test("isRuleEnabledForPath returns false when linter is disabled for path", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "vendor/bundle/file.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath returns false when rule is disabled", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": { enabled: false }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath returns false when path matches rule-specific exclude", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              exclude: ["app/views/legacy/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/legacy/old.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath returns true when path does not match rule-specific exclude", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              exclude: ["app/views/legacy/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(true)
    })

    test("isRuleEnabledForPath returns true when path matches rule-specific only", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              only: ["app/views/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(true)
    })

    test("isRuleEnabledForPath returns false when path does not match rule-specific only", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              only: ["app/views/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "lib/templates/email.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath respects both only and exclude patterns", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              only: ["app/views/**/*"],
              exclude: ["app/views/legacy/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(true)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/legacy/old.html.erb")).toBe(false)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "lib/templates/email.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath returns true when path matches rule-specific include", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              include: ["app/components/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/components/button.html.erb")).toBe(true)
    })

    test("isRuleEnabledForPath returns false when path does not match rule-specific include", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              include: ["app/components/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath respects include and exclude patterns", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              include: ["app/components/**/*"],
              exclude: ["app/components/legacy/**/*"]
            }
          }
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/components/button.html.erb")).toBe(true)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/components/legacy/old.html.erb")).toBe(false)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(false)
    })

    test("isRuleEnabledForPath only overrides include patterns", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              include: ["app/components/**/*"],
              only: ["app/views/**/*"],
              exclude: ["app/views/legacy/**/*"]
            }
          }
        }
      }

      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/home/index.html.erb")).toBe(true)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/components/button.html.erb")).toBe(false)
      expect(config.isRuleEnabledForPath("html-tag-name-lowercase", "app/views/legacy/old.html.erb")).toBe(false)
    })

    test("isEnabledForPath works for linter tool", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isEnabledForPath("app/views/home/index.html.erb", "linter")).toBe(true)
      expect(config.isEnabledForPath("vendor/bundle/file.html.erb", "linter")).toBe(false)
    })

    test("isEnabledForPath works for formatter tool", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          enabled: true,
          exclude: ["test/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.isEnabledForPath("app/views/home/index.html.erb", "formatter")).toBe(true)
      expect(config.isEnabledForPath("test/fixtures/sample.html.erb", "formatter")).toBe(false)
    })

    test("getFilesConfigForTool returns default patterns when no config", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      const linterFiles = config.getFilesConfigForTool("linter")
      expect(linterFiles.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb'
      ])
    })

    test("getFilesConfigForTool combines tool-specific with defaults", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          include: ["**/*.xml.erb"],
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const linterFiles = config.getFilesConfigForTool("linter")
      expect(linterFiles.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml.erb'
      ])
      expect(linterFiles.exclude).toEqual(["vendor/**/*"])
    })

    test("getFilesConfigForTool combines top-level with defaults", () => {
      const configOptions: HerbConfigOptions = {
        files: {
          include: ["**/*.xml"],
          exclude: ["public/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const linterFiles = config.getFilesConfigForTool("linter")

      expect(linterFiles.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml'
      ])
      expect(linterFiles.exclude).toEqual(["public/**/*"])
    })

    test("getFilesConfigForTool combines all levels (default + top + tool)", () => {
      const configOptions: HerbConfigOptions = {
        files: {
          include: ["**/*.xml"],
          exclude: ["public/**/*"]
        },
        formatter: {
          include: ["**/*.custom.erb"],
          exclude: ["test/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const formatterFiles = config.getFilesConfigForTool("formatter")

      expect(formatterFiles.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml',
        '**/*.custom.erb'
      ])
      expect(formatterFiles.exclude).toEqual(["test/**/*"])
    })

    test("filesConfigForLinter adds to defaults", () => {
      const configOptions: HerbConfigOptions = {
        linter: {
          include: ["**/*.xml.erb"],
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.filesConfigForLinter.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml.erb'
      ])
      expect(config.filesConfigForLinter.exclude).toEqual(["vendor/**/*"])
    })

    test("filesConfigForFormatter adds to defaults", () => {
      const configOptions: HerbConfigOptions = {
        formatter: {
          include: ["**/*.custom.erb"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.filesConfigForFormatter.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.custom.erb'
      ])
    })

    test("filesConfigForLinter uses default patterns when none specified", () => {
      const config = Config.fromObject({}, { projectPath: testDir })

      expect(config.filesConfigForLinter.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb'
      ])
    })

    test("filesConfigForFormatter combines with top-level", () => {
      const configOptions: HerbConfigOptions = {
        files: {
          include: ["**/*.custom.erb"],
          exclude: ["tmp/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.filesConfigForFormatter.include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.custom.erb'
      ])
      expect(config.filesConfigForFormatter.exclude).toEqual(["tmp/**/*"])
    })

    test("getFilesConfigForTool combines at all levels", () => {
      const configOptions: HerbConfigOptions = {
        files: {
          include: ["**/*.xml"]
        },
        linter: {
          include: ["**/*.custom.erb"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      expect(config.getFilesConfigForTool("linter").include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml',
        '**/*.custom.erb'
      ])
      expect(config.getFilesConfigForTool("formatter").include).toEqual([
        '**/*.html',
        '**/*.rhtml',
        '**/*.html.erb',
        '**/*.html+*.erb',
        '**/*.turbo_stream.erb',
        '**/*.xml'
      ])
    })

    test("findFilesForTool uses defaults", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      const file2 = createTestFile(testDir, "app/views/posts/show.html.erb")
      createTestFile(testDir, "app/views/layout.xml")

      const config = Config.fromObject({}, { projectPath: testDir })
      const files = await config.findFilesForTool("linter", testDir)

      expect(files.sort()).toEqual([file1, file2].sort())
    })

    test("findFilesForTool excludes patterns", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      createTestFile(testDir, "vendor/bundle/gem/file.html.erb")

      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["vendor/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const files = await config.findFilesForTool("linter", testDir)

      expect(files).toEqual([file1])
    })

    test("findFilesForTool adds custom patterns to defaults", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      const file2 = createTestFile(testDir, "app/views/posts/show.xml.erb")

      const configOptions: HerbConfigOptions = {
        formatter: {
          include: ["**/*.xml.erb"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const files = await config.findFilesForTool("formatter", testDir)

      expect(files.sort()).toEqual([file1, file2].sort())
    })

    test("findFilesForLinter finds linter files", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      const file2 = createTestFile(testDir, "app/views/posts/show.html.erb")

      const config = Config.fromObject({}, { projectPath: testDir })
      const files = await config.findFilesForLinter(testDir)

      expect(files.sort()).toEqual([file1, file2].sort())
    })

    test("findFilesForFormatter finds formatter files", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      createTestFile(testDir, "app/views/home/other.xml")

      const config = Config.fromObject({}, { projectPath: testDir })

      const files = await config.findFilesForFormatter(testDir)

      expect(files).toEqual([file1])
    })

    test("findFilesForTool can exclude defaults", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      createTestFile(testDir, "app/views/posts/show.html.erb")

      const configOptions: HerbConfigOptions = {
        linter: {
          exclude: ["app/views/posts/**/*"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const files = await config.findFilesForTool("linter", testDir)

      expect(files).toEqual([file1])
    })

    test("findFilesForTool combines all include patterns", async () => {
      const file1 = createTestFile(testDir, "app/views/home/index.html.erb")
      const file2 = createTestFile(testDir, "app/views/posts/show.xml.erb")
      createTestFile(testDir, "config/routes.rb")

      const configOptions: HerbConfigOptions = {
        linter: {
          include: ["**/*.xml.erb"]
        }
      }
      const config = Config.fromObject(configOptions, { projectPath: testDir })

      const files = await config.findFilesForTool("linter", testDir)

      expect(files.sort()).toEqual([file1, file2].sort())
    })
  })

  describe("Default patterns", () => {
    test("includes common ERB file patterns", () => {
      const config = Config.fromObject({}, { projectPath: testDir })
      const defaultPatterns = config.config.files?.include || []

      expect(defaultPatterns).toContain("**/*.html.erb")
      expect(defaultPatterns).toContain("**/*.html")
      expect(defaultPatterns).toContain("**/*.rhtml")
      expect(defaultPatterns).toContain("**/*.turbo_stream.erb")
    })
  })
})
