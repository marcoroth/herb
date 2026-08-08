import dedent from "dedent"
import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { Herb } from "@herb-tools/node-wasm"

import { Config } from "../src/config.js"
import { detectFrameworkFromGemfile, gemsFromGemfile } from "../src/framework-detection.js"

describe("framework detection", () => {
  let testDir: string

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(() => {
    testDir = join(tmpdir(), `herb-framework-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  function writeGemfile(content: string, filename: string = "Gemfile") {
    writeFileSync(join(testDir, filename), content)
  }

  function markProjectRoot() {
    mkdirSync(join(testDir, ".git"))
  }

  describe("gemsFromGemfile", () => {
    test("collects gems with and without version constraints", () => {
      const source = dedent`
        source "https://rubygems.org"

        gem "rails", "~> 8.0"
        gem "puma"
      `

      expect(gemsFromGemfile(source, Herb)).toEqual(["rails", "puma"])
    })

    test("collects gems declared inside blocks", () => {
      const source = dedent`
        group :development, :test do
          gem "rspec-rails"
        end

        platforms :ruby do
          gem "sqlite3"
        end
      `

      expect(gemsFromGemfile(source, Herb)).toEqual(["rspec-rails", "sqlite3"])
    })

    test("ignores commented out gems", () => {
      const source = dedent`
        # gem "rails"
        gem "sinatra"
      `

      expect(gemsFromGemfile(source, Herb)).toEqual(["sinatra"])
    })

    test("ignores gem calls without a literal name", () => {
      const source = dedent`
        gem name
        gem "rails"
      `

      expect(gemsFromGemfile(source, Herb)).toEqual(["rails"])
    })

    test("returns no gems for a Gemfile that isn't valid Ruby", () => {
      expect(gemsFromGemfile("gem 'rails'", Herb)).toEqual(["rails"])
      expect(gemsFromGemfile("group :development do", Herb)).toEqual([])
    })
  })

  describe("detectFrameworkFromGemfile", () => {
    test("detects Action View from rails", async () => {
      writeGemfile(`gem "rails", "~> 8.0"`)

      const detection = await detectFrameworkFromGemfile(testDir, Herb)

      expect(detection?.framework).toBe("actionview")
      expect(detection?.gem).toBe("rails")
      expect(detection?.gemfilePath).toBe(join(testDir, "Gemfile"))
    })

    test("detects Action View from a standalone actionview gem", async () => {
      writeGemfile(`gem "actionview"`)

      expect((await detectFrameworkFromGemfile(testDir, Herb))?.framework).toBe("actionview")
    })

    test("detects Hanami and Sinatra", async () => {
      writeGemfile(`gem "sinatra"`)
      expect((await detectFrameworkFromGemfile(testDir, Herb))?.framework).toBe("sinatra")

      writeGemfile(`gem "hanami"`)
      expect((await detectFrameworkFromGemfile(testDir, Herb))?.framework).toBe("hanami")
    })

    test("prefers Action View when a project depends on more than one framework", async () => {
      writeGemfile(dedent`
        gem "sinatra"
        gem "rails"
      `)

      expect((await detectFrameworkFromGemfile(testDir, Herb))?.framework).toBe("actionview")
    })

    test("falls back to gems.rb", async () => {
      writeGemfile(`gem "rails"`, "gems.rb")

      expect((await detectFrameworkFromGemfile(testDir, Herb))?.framework).toBe("actionview")
    })

    test("returns undefined without a Gemfile", async () => {
      expect(await detectFrameworkFromGemfile(testDir, Herb)).toBeUndefined()
    })

    test("returns undefined for a Gemfile without a framework gem", async () => {
      writeGemfile(dedent`
        gem "rake"
        gem "minitest"
      `)

      expect(await detectFrameworkFromGemfile(testDir, Herb)).toBeUndefined()
    })
  })

  describe("Config.load warnings", () => {
    let warnings: string[]

    beforeEach(() => {
      warnings = []

      vi.spyOn(console, "error").mockImplementation((message: any) => {
        warnings.push(String(message))
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    function frameworkWarnings() {
      return warnings.filter(warning => warning.includes("`framework`"))
    }

    test("warns and suggests the detected framework when the config file doesn't set one", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "version: 0.10.3\n")
      writeGemfile(`gem "rails", "~> 8.0"`)

      await Config.loadForCLI(testDir, "0.10.3", false, Herb)

      expect(frameworkWarnings()).toHaveLength(1)
      expect(frameworkWarnings()[0]).toContain("No `framework` set in")
      expect(frameworkWarnings()[0]).toContain("Your Gemfile depends on `rails`")
      expect(frameworkWarnings()[0]).toContain("`framework: actionview`")
    })

    test("warns without a suggestion when no framework gem is in the Gemfile", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "version: 0.10.3\n")
      writeGemfile(`gem "rake"`)

      await Config.loadForCLI(testDir, "0.10.3", false, Herb)

      expect(frameworkWarnings()).toHaveLength(1)
      expect(frameworkWarnings()[0]).toContain("Set `framework` to one of")
    })

    test("doesn't warn when the config file sets a framework", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "version: 0.10.3\nframework: actionview\n")
      writeGemfile(`gem "rails"`)

      const config = await Config.loadForCLI(testDir, "0.10.3", false, Herb)

      expect(config.framework).toBe("actionview")
      expect(frameworkWarnings()).toHaveLength(0)
    })

    test("doesn't warn in silent mode", async () => {
      writeFileSync(join(testDir, ".herb.yml"), "version: 0.10.3\n")
      writeGemfile(`gem "rails"`)

      await Config.loadForEditor(testDir, "0.10.3")

      expect(frameworkWarnings()).toHaveLength(0)
    })
  })

  describe("Config creation", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test("writes the detected framework into the created config file", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})

      writeGemfile(`gem "rails", "~> 8.0"`)

      const config = await Config.loadForCLI(testDir, "0.10.3", true, Herb)
      const content = readFileSync(config.path, "utf8")

      expect(content).toContain("framework: actionview")
      expect(content).not.toContain("# framework: ruby")
      expect(config.framework).toBe("actionview")
      expect(config.hasExplicitFramework).toBe(true)
    })

    test("leaves the framework commented out when the project has no Gemfile", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})

      markProjectRoot()

      const config = await Config.loadForCLI(testDir, "0.10.3", true, Herb)
      const content = readFileSync(config.path, "utf8")

      expect(content).toContain("# framework: ruby")
      expect(config.hasExplicitFramework).toBe(false)
    })

    test("createConfigYamlString sets the framework it is given", () => {
      const content = Config.createConfigYamlString({}, "0.10.3", "hanami")

      expect(content).toContain("framework: hanami")
      expect(content).not.toContain("# framework: ruby")
      expect(content).toContain("# template_engine: erubi")
    })
  })
})
