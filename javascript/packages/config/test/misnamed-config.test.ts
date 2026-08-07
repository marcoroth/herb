import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { Config } from "../src/config.js"

describe("misnamed config files", () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `herb-misnamed-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(testDir, ".git"), { recursive: true })
    writeFileSync(join(testDir, ".git", "HEAD"), "ref: refs/heads/main\n")
  })

  afterEach(() => {
    vi.restoreAllMocks()

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  function captureStderr() {
    const messages: string[] = []

    vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
      messages.push(args.join(" "))
    })

    return messages
  }

  describe("Config.misnamedConfigPaths", () => {
    test("covers the wrong extension and the missing leading dot", () => {
      expect(Config.misnamedConfigPaths).toEqual([".herb.yaml", "herb.yml", "herb.yaml"])
    })
  })

  describe("Config.isMisnamedConfigPath", () => {
    test("recognizes misnamed config files", () => {
      expect(Config.isMisnamedConfigPath(".herb.yaml")).toBe(true)
      expect(Config.isMisnamedConfigPath("herb.yml")).toBe(true)
      expect(Config.isMisnamedConfigPath("herb.yaml")).toBe(true)
      expect(Config.isMisnamedConfigPath("/project/.herb.yaml")).toBe(true)
    })

    test("ignores the config file Herb reads", () => {
      expect(Config.isMisnamedConfigPath(".herb.yml")).toBe(false)
      expect(Config.isMisnamedConfigPath("/project/.herb.yml")).toBe(false)
    })

    test("ignores unrelated files", () => {
      expect(Config.isMisnamedConfigPath("config.yml")).toBe(false)
      expect(Config.isMisnamedConfigPath("myherb.yml")).toBe(false)
      expect(Config.isMisnamedConfigPath(".herb.yml.bak")).toBe(false)
      expect(Config.isMisnamedConfigPath("/project")).toBe(false)
    })
  })

  describe("Config.findMisnamedConfigPaths", () => {
    test("returns every misnamed config file", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "")
      writeFileSync(join(testDir, "herb.yaml"), "")

      expect(await Config.findMisnamedConfigPaths(testDir)).toEqual([
        join(testDir, ".herb.yaml"),
        join(testDir, "herb.yaml")
      ])
    })

    test("ignores the config file Herb reads", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "")

      expect(await Config.findMisnamedConfigPaths(testDir)).toEqual([])
    })

  })

  describe("Config.misnamedConfigWarning", () => {
    test("names the file and the fix", () => {
      expect(Config.misnamedConfigWarning("/project/.herb.yaml")).toBe(
        "⚠ Ignoring /project/.herb.yaml: Herb only reads `.herb.yml`. Rename it to `.herb.yml` to apply it."
      )
    })
  })

  describe("Config.load", () => {
    test("warns about a config file with the wrong extension", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "linter:\n  enabled: false\n")

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3" })

      expect(messages).toContain(Config.misnamedConfigWarning(join(testDir, ".herb.yaml")))
    })

    test("warns about a config file missing the leading dot", async () => {
      writeFileSync(join(testDir, "herb.yml"), "linter:\n  enabled: false\n")

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3" })

      expect(messages).toContain(Config.misnamedConfigWarning(join(testDir, "herb.yml")))
    })

    test("warns once about every misnamed config file", async () => {
      for (const filename of Config.misnamedConfigPaths) {
        writeFileSync(join(testDir, filename), "")
      }

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3" })

      const warnings = messages.filter(message => message.includes("Herb only reads"))

      expect(warnings).toEqual(Config.misnamedConfigPaths.map(filename => Config.misnamedConfigWarning(join(testDir, filename))))
    })

    test("warns when a misnamed config file is passed explicitly", async () => {
      const misnamedPath = join(testDir, ".herb.yaml")

      writeFileSync(misnamedPath, "linter:\n  enabled: false\n")

      const messages = captureStderr()

      await Config.load(misnamedPath, { version: "0.10.3" })

      expect(messages.filter(message => message.includes("Herb only reads"))).toEqual([Config.misnamedConfigWarning(misnamedPath)])
    })

    test("does not warn when only the config file Herb reads exists", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "linter:\n  enabled: false\n")

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3" })

      expect(messages.filter(message => message.includes("Herb only reads"))).toEqual([])
    })

    test("does not warn in silent mode", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "")

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3", silent: true })

      expect(messages).toEqual([])
    })

    test("does not read a misnamed config file", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "version: 0.8.0\nformatter:\n  indentWidth: 8\n")

      const config = await Config.load(testDir, { version: "0.10.3", silent: true })

      expect(config.configVersion).toBeUndefined()
      expect(config.formatter?.indentWidth).not.toBe(8)
    })

    test("still reads the config file next to a misnamed one", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "version: 0.8.0\nformatter:\n  indentWidth: 4\n")
      writeFileSync(join(testDir, ".herb.yaml"), "version: 0.9.0\nformatter:\n  indentWidth: 8\n")

      const messages = captureStderr()

      const config = await Config.load(testDir, { version: "0.10.3" })

      expect(config.path).toBe(join(testDir, ".herb.yml"))
      expect(config.configVersion).toBe("0.8.0")
      expect(config.formatter?.indentWidth).toBe(4)
      expect(messages).toContain(Config.misnamedConfigWarning(join(testDir, ".herb.yaml")))
    })

    test("creates the default config next to a misnamed one instead of exiting", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "linter:\n  enabled: false\n")

      const messages = captureStderr()

      await Config.load(testDir, { version: "0.10.3", createIfMissing: true })

      expect(existsSync(join(testDir, ".herb.yml"))).toBe(true)
      expect(messages).toContain(Config.misnamedConfigWarning(join(testDir, ".herb.yaml")))
    })
  })

  describe("Config.validateConfigText", () => {
    test("reports a config file with the wrong extension", async () => {
      writeFileSync(join(testDir, ".herb.yaml"), "")

      const errors = await Config.validateConfigText("version: 0.10.3\n", { version: "0.10.3", projectPath: testDir })
      const warning = errors.find(error => error.code === "wrong_file_extension")

      expect(warning?.message).toBe("Found .herb.yaml file. Please rename to .herb.yml")
      expect(warning?.severity).toBe("warning")
    })

    test("reports a config file missing the leading dot", async () => {
      writeFileSync(join(testDir, "herb.yml"), "")

      const errors = await Config.validateConfigText("version: 0.10.3\n", { version: "0.10.3", projectPath: testDir })
      const warning = errors.find(error => error.code === "wrong_file_extension")

      expect(warning?.message).toBe("Found herb.yml file. Please rename to .herb.yml")
    })

    test("reports every misnamed config file", async () => {
      for (const filename of Config.misnamedConfigPaths) {
        writeFileSync(join(testDir, filename), "")
      }

      const errors = await Config.validateConfigText("version: 0.10.3\n", { version: "0.10.3", projectPath: testDir })

      expect(errors.filter(error => error.code === "wrong_file_extension")).toHaveLength(3)
    })

    test("does not report anything when only the config file Herb reads exists", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "")

      const errors = await Config.validateConfigText("version: 0.10.3\n", { version: "0.10.3", projectPath: testDir })

      expect(errors.filter(error => error.code === "wrong_file_extension")).toEqual([])
    })
  })
})
