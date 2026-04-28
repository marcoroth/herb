import { beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { getLanguageService } from "../src/index.js"

import type { IHTMLDataProvider, LanguageServiceOptions } from "../src/index.js"

export const testDataProvider: IHTMLDataProvider = {
  getId: () => "test",
  isApplicable: () => true,
  provideTags: () => [],

  provideAttributes: (_tag: string) => [
    { name: "data-controller" },
    { name: "data-action" },
    { name: "data-target" },
  ],

  provideValues: (_tag: string, attribute: string) => {
    if (attribute === "data-controller") {
      return [
        { name: "scroll" },
        { name: "hello" },
        { name: "search" },
      ]
    }

    if (attribute === "data-action") {
      return [{ name: "click->scroll#go" }]
    }

    return []
  },
}

export function setupHerb() {
  beforeAll(async () => {
    await Herb.load()
  })
}

export function createService(options?: Partial<LanguageServiceOptions>) {
  return getLanguageService({
    herb: Herb,
    customDataProviders: [testDataProvider],
    tokenListAttributes: ["data-controller", "data-action"],
    ...options,
  })
}

export function createDocument(content: string, languageId = "erb") {
  return TextDocument.create("file:///test.html.erb", languageId, 1, content)
}

export { Herb, getLanguageService }
