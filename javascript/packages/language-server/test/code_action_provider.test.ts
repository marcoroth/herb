import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { CodeActionParams, Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { CodeActionProvider } from "../src/code_action_provider"
import { Project } from "../src/project"

import type { TextDocumentEdit } from "vscode-languageserver/node"
import type { PersonalHerbSettings } from "../src/user_settings"

const RULE = "herb-config-framework-option"
const URI = "file:///project/app/views/users/show.html.erb"

describe("CodeActionProvider", () => {
  let projectPath: string

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(() => {
    projectPath = join(tmpdir(), `herb-code-action-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    mkdirSync(projectPath, { recursive: true })
  })

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true })
  })

  function writeConfig(content: string) {
    writeFileSync(join(projectPath, ".herb.yml"), content)
  }

  async function createService(settings: Partial<PersonalHerbSettings> = {}) {
    const project = { root: projectPath, herbBackend: Herb, settingsFor: async () => settings } as unknown as Project
    const config = await Config.loadForEditor(projectPath, "0.10.3")

    return new CodeActionProvider(project, config)
  }

  function frameworkDiagnostic(message: string): Diagnostic {
    return {
      range: Range.create(0, 0, 0, 0),
      message,
      severity: DiagnosticSeverity.Hint,
      source: "Herb Linter ",
      data: { rule: RULE }
    }
  }

  function setFrameworkActions(actions: Awaited<ReturnType<CodeActionProvider["createCodeActions"]>>) {
    return actions.filter(action => action.title.includes("Set `framework"))
  }

  function configEdit(action: { edit?: { changes?: Record<string, { newText: string }[]>, documentChanges?: unknown[] } }) {
    const changes = action.edit?.changes

    if (changes) return Object.values(changes)[0][0].newText

    const documentChanges = action.edit?.documentChanges as TextDocumentEdit[]

    return documentChanges[documentChanges.length - 1].edits[0].newText
  }

  it("offers the suggested framework when the offense names one", async () => {
    writeConfig("version: 0.10.3\n")

    const service = await createService()
    const diagnostic = frameworkDiagnostic("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `image_tag` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

    const actions = setFrameworkActions(service.createCodeActions(URI, [diagnostic], "<%= image_tag %>"))

    expect(actions).toHaveLength(1)
    expect(actions[0].title).toBe("Herb Linter: Set `framework: actionview` in `.herb.yml`")
    expect(configEdit(actions[0])).toContain("framework: actionview")
  })

  it("offers every framework when the offense names none", async () => {
    writeConfig("version: 0.10.3\n")

    const service = await createService()
    const diagnostic = frameworkDiagnostic("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

    const actions = setFrameworkActions(service.createCodeActions(URI, [diagnostic], "<div></div>"))

    expect(actions.map(action => action.title)).toEqual([
      "Herb Linter: Set `framework: ruby` in `.herb.yml`",
      "Herb Linter: Set `framework: actionview` in `.herb.yml`",
      "Herb Linter: Set `framework: hanami` in `.herb.yml`",
      "Herb Linter: Set `framework: sinatra` in `.herb.yml`"
    ])
  })

  it("keeps the comments in an existing config file", async () => {
    writeConfig("# keep me\nversion: 0.10.3\n\nlinter:\n  enabled: true\n")

    const service = await createService()
    const diagnostic = frameworkDiagnostic("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `link_to` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

    const actions = setFrameworkActions(service.createCodeActions(URI, [diagnostic], "<%= link_to %>"))
    const newContent = configEdit(actions[0])

    expect(newContent).toContain("# keep me")
    expect(newContent).toContain("framework: actionview")
    expect(newContent).toContain("linter:")
  })

  it("creates a config file when the project has none", async () => {
    const service = await createService()
    const diagnostic = frameworkDiagnostic("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `form_with` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

    const actions = setFrameworkActions(service.createCodeActions(URI, [diagnostic], "<%= form_with %>"))

    expect(actions).toHaveLength(1)
    expect(actions[0].edit?.documentChanges?.[0]).toMatchObject({ kind: "create" })
    expect(configEdit(actions[0])).toContain("framework: actionview")
  })

  it("offers nothing once the project sets a framework", async () => {
    writeConfig("version: 0.10.3\nframework: actionview\n")

    const service = await createService()
    const diagnostic = frameworkDiagnostic("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `image_tag` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

    const actions = setFrameworkActions(service.createCodeActions(URI, [diagnostic], "<%= image_tag %>"))

    expect(actions).toHaveLength(0)
  })

  it("fixes indentation to the style the diagnostics were reported against", async () => {
    const service = await createService({ formatter: { indentStyle: "tab", indentWidth: 2 } })
    const document = TextDocument.create(URI, "erb", 1, "<div>\n  <span>Hello</span>\n</div>\n")

    const diagnostic: Diagnostic = {
      range: Range.create(1, 0, 1, 2),
      message: "Indent with tabs instead of spaces.",
      severity: DiagnosticSeverity.Error,
      source: "Herb Linter ",
      code: "source-indentation",
      data: { rule: "source-indentation" }
    }

    const params = {
      textDocument: { uri: URI },
      range: diagnostic.range,
      context: { diagnostics: [diagnostic] }
    } as CodeActionParams

    const actions = await service.autofixCodeActions(params, document)
    const fix = actions.find(action => action.title.includes("Indent with tabs"))

    expect(fix).toBeDefined()
    expect(fix?.edit?.changes?.[URI][0].newText).toBe("<div>\n\t<span>Hello</span>\n</div>\n")
  })
})
