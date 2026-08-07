import { describe, test, expect } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"
import { DiagnosticSeverity } from "vscode-languageserver/node"
import { Config } from "@herb-tools/config"

import { ConfigService } from "../src/config_service"
import { isConfigDocument } from "../src/utils"

function documentFor(fileName: string, content = "") {
  return TextDocument.create(`file:///project/${fileName}`, "yaml", 1, content)
}

describe("isConfigDocument", () => {
  test("recognizes the config file Herb reads", () => {
    expect(isConfigDocument("file:///project/.herb.yml")).toBe(true)
  })

  test("recognizes misnamed config files", () => {
    for (const misnamedPath of Config.misnamedConfigPaths) {
      expect(isConfigDocument(`file:///project/${misnamedPath}`)).toBe(true)
    }
  })

  test("ignores templates and unrelated files", () => {
    expect(isConfigDocument("file:///project/app/views/index.html.erb")).toBe(false)
    expect(isConfigDocument("file:///project/config.yml")).toBe(false)
    expect(isConfigDocument("file:///project/.herb.yml.bak")).toBe(false)
  })
})

describe("ConfigService", () => {
  test("reports a misnamed config file as ignored", async () => {
    const service = new ConfigService("/project")
    const diagnostics = await service.validateDocument(documentFor(".herb.yaml", "linter:\n  enabled: false\n"))

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe("wrong_file_extension")
    expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error)
    expect(diagnostics[0].message).toBe(
      "Herb only reads `.herb.yml`, so this file is ignored. Rename it to `.herb.yml` to apply it."
    )
    expect(diagnostics[0].range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 2, character: 0 }
    })
  })

  test("spans the whole misnamed config file", async () => {
    const service = new ConfigService("/project")
    const diagnostics = await service.validateDocument(documentFor(".herb.yaml", "linter:\n  enabled: false\n  rules: {}"))

    expect(diagnostics[0].range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 2, character: 11 }
    })
  })

  test("spans a single character for an empty misnamed config file", async () => {
    const service = new ConfigService("/project")
    const diagnostics = await service.validateDocument(documentFor(".herb.yaml", ""))

    expect(diagnostics[0].range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 }
    })
  })

  test("reports every misnamed variant", async () => {
    const service = new ConfigService("/project")

    for (const misnamedPath of Config.misnamedConfigPaths) {
      const diagnostics = await service.validateDocument(documentFor(misnamedPath))

      expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(["wrong_file_extension"])
    }
  })

  test("does not validate the contents of a misnamed config file", async () => {
    const service = new ConfigService("/project")
    const diagnostics = await service.validateDocument(documentFor(".herb.yaml", "linter: [unclosed\n"))

    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(["wrong_file_extension"])
  })

  test("returns nothing for a document that isn't a config file", async () => {
    const service = new ConfigService("/project")
    const document = TextDocument.create("file:///project/app/views/index.html.erb", "erb", 1, "<div></div>")

    expect(await service.validateDocument(document)).toEqual([])
  })
})
