import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { Herb } from "@herb-tools/node-wasm"

import { Project } from "../src/project"
import { Capabilities } from "../src/capabilities"
import { UserSettings } from "../src/user_settings"
import { ParserService } from "@herb-tools/language-service"
import { DefinitionProvider } from "@herb-tools/language-service"

import type { Connection, InitializeParams } from "vscode-languageserver/node"
import type { Documents } from "../src/documents"
import type { SharedServices } from "../src/project"

describe("Project", () => {
  let root: string

  beforeAll(async () => {
    await Herb.load()
  })

  const connection = {
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
  } as unknown as Connection

  const params = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  } as InitializeParams

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "herb-project-"))
    mkdirSync(join(root, "app/views/posts"), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function projectFor(userSettings?: UserSettings, capabilities = new Capabilities(params)): Project {
    const parserService = new ParserService(Herb)

    const shared: SharedServices = {
      documents: { documents: {}, get: () => undefined } as unknown as Documents,
      parserService,
      definitionProvider: new DefinitionProvider(parserService, existsSync, (filePath: string) => { try { return readFileSync(filePath, "utf-8") } catch { return null } }),
      userSettings: userSettings ?? new UserSettings(connection, capabilities),
      capabilities,
    }

    return new Project(connection, root, shared)
  }

  describe("framework", () => {
    test("exposes the framework a checked-in config sets", async () => {
      writeFileSync(join(root, ".herb.yml"), "framework: actionview\n")

      const project = projectFor()
      await project.loadConfig()

      expect(project.framework).toBe("actionview")
    })

    test("is undefined when the project has no config file", async () => {
      const project = projectFor()
      await project.loadConfig()

      expect(project.framework).toBeUndefined()
    })

    test("picks up a framework that is added to the config while the server runs", async () => {
      const project = projectFor()
      await project.loadConfig()

      expect(project.framework).toBeUndefined()

      writeFileSync(join(root, ".herb.yml"), "framework: actionview\n")
      await project.refreshConfig()

      expect(project.framework).toBe("actionview")
    })

    test("picks up a framework that changes while the server runs", async () => {
      writeFileSync(join(root, ".herb.yml"), "framework: actionview\n")

      const project = projectFor()
      await project.loadConfig()

      expect(project.framework).toBe("actionview")

      writeFileSync(join(root, ".herb.yml"), "framework: sinatra\n")
      await project.refreshConfig()

      expect(project.framework).toBe("sinatra")
    })
  })

  describe("settingsFor", () => {
    test("lets a checked-in config turn the formatter on when the user never opted in", async () => {
      writeFileSync(join(root, ".herb.yml"), "formatter:\n  enabled: true\n")

      const capabilities = new Capabilities(params)
      const userSettings = new UserSettings(connection, capabilities)

      const project = projectFor(userSettings, capabilities)
      await project.loadConfig()

      const uri = `file://${join(root, "app/views/posts/index.html.erb")}`

      expect((await userSettings.getDocumentSettings(uri)).formatter?.enabled).toBe(false)
      expect((await project.settingsFor(uri)).formatter?.enabled).toBe(true)
    })

    test("lets a checked-in config turn the linter off", async () => {
      writeFileSync(join(root, ".herb.yml"), "linter:\n  enabled: false\n")

      const project = projectFor()
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.linter?.enabled).toBe(false)
    })

    test("carries the config's formatter dimensions through", async () => {
      writeFileSync(join(root, ".herb.yml"), "formatter:\n  enabled: true\n  indentWidth: 8\n  maxLineLength: 120\n")

      const project = projectFor()
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.formatter?.indentWidth).toBe(8)
      expect(settings.formatter?.maxLineLength).toBe(120)
    })

    test("carries the config's indent style through", async () => {
      writeFileSync(join(root, ".herb.yml"), "formatter:\n  enabled: true\n  indentStyle: tab\n")

      const project = projectFor()
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.formatter?.indentStyle).toBe("tab")
    })

    test("reads an unset indent style as space, not as an opening for the user's preference", async () => {
      writeFileSync(join(root, ".herb.yml"), "formatter:\n  enabled: true\n")

      const capabilities = new Capabilities(params)
      const userSettings = new UserSettings(connection, capabilities)

      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        formatter: { indentStyle: "tab" }
      })

      const project = projectFor(userSettings, capabilities)
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.formatter?.indentStyle).toBe("space")
    })

    test("leaves personal settings alone, since a project can't have an opinion on them", async () => {
      writeFileSync(join(root, ".herb.yml"), "formatter:\n  enabled: true\n")

      const project = projectFor()
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.linter?.fixOnSave).toBe(true)
    })

    test("falls back to the user's settings when the project has no config file", async () => {
      const project = projectFor()
      await project.loadConfig()

      const settings = await project.settingsFor(`file://${join(root, "app/views/posts/index.html.erb")}`)

      expect(settings.formatter?.enabled).toBe(false)
      expect(settings.linter?.enabled).toBe(true)
    })
  })
})
