import { describe, test, expect, beforeAll, afterAll } from "vitest"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { Config } from "../src/config.js"

describe("findProjectRootSync with .herb.yaml", () => {
  const tempDir = join(process.cwd(), "tmp-test-find-project-root-yaml")

  beforeAll(() => {
    mkdirSync(join(tempDir, "app", "views"), { recursive: true })

    writeFileSync(join(tempDir, ".herb.yaml"), "linter:\n  enabled: true\n")
    writeFileSync(join(tempDir, "app", "views", "index.html.erb"), "<div></div>\n")
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test("finds project root with .herb.yaml", () => {
    const filePath = join(tempDir, "app", "views", "index.html.erb")
    const projectRoot = Config.findProjectRootSync(filePath)

    expect(projectRoot).toBe(tempDir)
  })
})

describe("findProjectRootSync", () => {
  const tempDir = join(process.cwd(), "tmp-test-find-project-root")

  beforeAll(() => {
    mkdirSync(join(tempDir, "app", "frontend", "components"), { recursive: true })
    mkdirSync(join(tempDir, "app", "views", "layouts"), { recursive: true })

    writeFileSync(join(tempDir, ".herb.yml"), "linter:\n  exclude:\n    - 'app/views/**/*.html.erb'\n")
    writeFileSync(join(tempDir, "app", "frontend", "README.md"), "# Frontend\n")
    writeFileSync(join(tempDir, "app", "frontend", "components", "button.html.erb"), "<button></button>\n")
    writeFileSync(join(tempDir, "app", "views", "layouts", "application.html.erb"), "<html></html>\n")
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test("finds project root with .herb.yml over subdirectory with README.md", () => {
    const filePath = join(tempDir, "app", "frontend", "components", "button.html.erb")
    const projectRoot = Config.findProjectRootSync(filePath)

    expect(projectRoot).toBe(tempDir)
  })

  test("finds project root from deeply nested file path", () => {
    const filePath = join(tempDir, "app", "views", "layouts", "application.html.erb")
    const projectRoot = Config.findProjectRootSync(filePath)

    expect(projectRoot).toBe(tempDir)
  })

  test("prefers .herb.yml over soft project indicators like README.md", () => {
    const filePath = join(tempDir, "app", "frontend", "components", "button.html.erb")
    const projectRoot = Config.findProjectRootSync(filePath)

    expect(projectRoot).not.toBe(join(tempDir, "app", "frontend"))
    expect(projectRoot).toBe(tempDir)
  })
})
