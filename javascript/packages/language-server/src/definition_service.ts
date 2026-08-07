import { Location, LocationLink, Position, Range } from "vscode-languageserver/node"
import { ParserService } from "./parser_service"
import { RenderCollector } from "./render_collector"

import { existsSync } from "fs"
import { posix as path } from "path"
import { pathFromUri, uriFromPath } from "./utils"
import { isPositionInRange, lspRangeFromLocation } from "./range_utils"

import type { TextDocument } from "vscode-languageserver-textdocument"
import type { DocumentNode } from "@herb-tools/core"

const VIEWS_DIRECTORY = "/app/views/"
const APPLICATION_DIRECTORY = "application"
const TEMPLATE_EXTENSIONS = ["html.erb", "html.herb", "turbo_stream.erb", "turbo_stream.herb", "erb", "herb"]
const PARTIAL_NAME = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/
const PARTIAL_KEYWORD = "partial"
const IDENTIFIER_CHARACTER = /[A-Za-z0-9_]/
const QUOTE = /^["']/

interface PartialReference {
  name: string
  triggerRange: Range
  originRange: Range
}

export class DefinitionService {
  private parserService: ParserService
  private exists: (filePath: string) => boolean

  constructor(parserService: ParserService, exists: (filePath: string) => boolean = existsSync) {
    this.parserService = parserService
    this.exists = exists
  }

  getDefinition(document: TextDocument, position: Position): LocationLink[] {
    const reference = this.partialAt(document, position)

    if (!reference) return []

    const targetRange = Range.create(Position.create(0, 0), Position.create(0, 0))

    return this.resolve(pathFromUri(document.uri), reference.name).map(filePath => ({
      originSelectionRange: reference.originRange,
      targetUri: uriFromPath(filePath),
      targetRange,
      targetSelectionRange: targetRange,
    }))
  }

  static asLocations(links: LocationLink[]): Location[] {
    return links.map(link => Location.create(link.targetUri, link.targetRange))
  }

  private partialAt(document: TextDocument, position: Position): PartialReference | null {
    const result = this.parserService.parseContent(document.getText(), { render_nodes: true })

    if (result.failed) return null

    const collector = new RenderCollector()

    collector.visit(result.value as DocumentNode)

    for (const render of collector.renders) {
      const partial = render.keywords?.partial

      if (!partial) continue

      const range = lspRangeFromLocation(partial.location)
      const triggerRange = this.withKeyword(document, range)

      if (!isPositionInRange(position, triggerRange)) continue
      if (!QUOTE.test(document.getText(range))) return null
      if (!PARTIAL_NAME.test(partial.value)) return null

      return { name: partial.value, triggerRange, originRange: this.withoutQuotes(document, range) }
    }

    return null
  }

  private withKeyword(document: TextDocument, range: Range): Range {
    const before = document.getText(Range.create(Position.create(range.start.line, 0), range.start))
    const upToColon = before.trimEnd()

    if (!upToColon.endsWith(":")) return range

    const upToKeyword = upToColon.slice(0, -1).trimEnd()

    if (!upToKeyword.endsWith(PARTIAL_KEYWORD)) return range

    const keywordStart = upToKeyword.length - PARTIAL_KEYWORD.length
    const characterBefore = upToKeyword[keywordStart - 1]

    if (characterBefore && IDENTIFIER_CHARACTER.test(characterBefore)) return range

    return Range.create(Position.create(range.start.line, keywordStart), range.end)
  }

  private withoutQuotes(document: TextDocument, range: Range): Range {
    const text = document.getText(range)

    if (!QUOTE.test(text) || text.at(-1) !== text[0]) return range

    return Range.create(
      Position.create(range.start.line, range.start.character + 1),
      Position.create(range.end.line, range.end.character - 1)
    )
  }

  private resolve(documentPath: string, name: string): string[] {
    const segments = name.split("/")
    const base = segments.pop()!
    const viewsRoot = this.viewsRoot(documentPath)
    const documentDirectory = path.dirname(documentPath)
    const directories: string[] = []

    if (segments.length > 0) {
      if (viewsRoot) directories.push(path.join(viewsRoot, ...segments))

      directories.push(path.join(documentDirectory, ...segments))
    } else {
      directories.push(documentDirectory)

      if (viewsRoot) directories.push(path.join(viewsRoot, APPLICATION_DIRECTORY))
    }

    const extensions = [...new Set([this.templateExtension(documentPath), ...TEMPLATE_EXTENSIONS])]

    const candidates = [...new Set(
      directories.flatMap(directory => extensions.map(extension => path.join(directory, `_${base}.${extension}`)))
    )]

    return candidates.filter(candidate => this.exists(candidate))
  }

  private viewsRoot(documentPath: string): string | null {
    const index = documentPath.lastIndexOf(VIEWS_DIRECTORY)

    if (index === -1) return null

    return documentPath.slice(0, index + VIEWS_DIRECTORY.length - 1)
  }

  private templateExtension(documentPath: string): string {
    const [, ...extensions] = path.basename(documentPath).split(".")

    return extensions.length > 0 ? extensions.join(".") : TEMPLATE_EXTENSIONS[0]
  }
}
