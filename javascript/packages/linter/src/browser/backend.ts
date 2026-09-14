import { HerbBackend, LexResult, ParseResult, ParserOptions, TokenList } from "@herb-tools/core"

import { domToAST } from "./dom-to-ast.js"

import type { ParseOptions } from "@herb-tools/core"
import type { DOMNodeLike } from "./dom-to-ast.js"

export interface DOMParserLike {
  parseFromString(source: string, type: string): DOMNodeLike
}

function ambientParser(): DOMParserLike {
  const Parser = (globalThis as { DOMParser?: new () => DOMParserLike }).DOMParser

  if (!Parser) {
    throw new Error("HerbDOMBackend needs a DOMParser to read markup with, and there is none here")
  }

  return new Parser()
}

export class HerbDOMBackend extends HerbBackend {
  readonly lintEnvironment = "browser" as const

  private readonly parser: DOMParserLike | null

  constructor(parser: DOMParserLike | null = null) {
    super(async () => ({}) as never)

    this.parser = parser
  }

  async load(): Promise<this> {
    return this
  }

  parse<const Options extends ParseOptions>(source: string, _options?: Options): never {
    const document = (this.parser ?? ambientParser()).parseFromString(source, "text/html")

    return new ParseResult(domToAST(document), source, [], [], new ParserOptions(), null) as never
  }

  lex(source: string): LexResult {
    return new LexResult(TokenList.from([]), source, [], [])
  }

  lexFile(_path: string): LexResult {
    throw new Error("HerbDOMBackend reads markup, not files")
  }

  parseFile(_path: string): never {
    throw new Error("HerbDOMBackend reads markup, not files")
  }

  backendVersion(): string {
    return "dom"
  }
}
