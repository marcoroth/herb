import dedent from "dedent"
import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { Config } from "../src/config.js"
import type { HerbConfigOptions } from "../src/config.js"

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
      const config = new Config(testDir, { version: "0.7.5" })
      expect(config).toBeInstanceOf(Config)
    })

    test("sets correct config path", () => {
      const config = new Config(testDir, { version: "0.7.5" })
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
      writeFileSync(configPath, "version: 0.7.5\n")

      expect(Config.exists(testDir)).toBe(true)
    })

    test("handles explicit .herb.yml path", () => {
      const configPath = join(testDir, ".herb.yml")
      writeFileSync(configPath, "version: 0.7.5\n")

      expect(Config.exists(configPath)).toBe(true)
    })
  })

  describe("Config.readRawYaml", () => {
    test("reads raw YAML content from config file", () => {
      const configPath = join(testDir, ".herb.yml")
      const yamlContent = dedent`
        version: 0.7.5
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
      const yamlContent = "version: 0.7.5\n"
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
        version: 0.7.5
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

      expect(updatedYaml).toContain("version: 0.7.5")
      expect(updatedYaml).toContain("enabled: true")
      expect(updatedYaml).toContain("html-tag-name-lowercase:")
      expect(updatedYaml).toContain("enabled: false")
    })

    test("merges rules without overwriting existing rules", () => {
      const existingYaml = dedent`
        version: 0.7.5
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
        version: 0.7.5
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
  })

  describe("Config.DEFAULT_EXTENSIONS", () => {
    test("includes common ERB extensions", () => {
      expect(Config.DEFAULT_EXTENSIONS).toContain(".html.erb")
      expect(Config.DEFAULT_EXTENSIONS).toContain(".html")
      expect(Config.DEFAULT_EXTENSIONS).toContain(".rhtml")
      expect(Config.DEFAULT_EXTENSIONS).toContain(".turbo_stream.erb")
    })
  })
})
