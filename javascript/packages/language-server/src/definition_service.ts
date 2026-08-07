import { Hover, Location, LocationLink, MarkupKind, Position, Range } from "vscode-languageserver/node"
import { IdentityPrinter } from "@herb-tools/printer"
import { ParserService } from "./parser_service"
import { RenderCollector } from "./render_collector"

import { existsSync, readFileSync } from "fs"
import { posix as path } from "path"
import { pathFromUri, uriFromPath } from "./utils"
import { isPositionInRange, lspRangeFromLocation } from "./range_utils"
import { getTagName, isERBStrictLocalsNode, isHTMLElementNode, isPureWhitespaceNode } from "@herb-tools/core"

import type { TextDocument } from "vscode-languageserver-textdocument"
import type { DocumentNode, ERBRenderNode, Node } from "@herb-tools/core"

const VIEWS_DIRECTORY = "/app/views/"
const APPLICATION_DIRECTORY = "application"
const TEMPLATE_EXTENSIONS = ["html.erb", "html.herb", "turbo_stream.erb", "turbo_stream.herb", "erb", "herb"]
const PARTIAL_NAME = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/
const PARTIAL_KEYWORDS = ["partial", "layout"]
const IDENTIFIER_CHARACTER = /[A-Za-z0-9_]/
const QUOTE = /^["']/
const SNIPPET_LINES = 6
const OPEN_TAG_WIDTH = 80
const PRINT_OPTIONS = { ignoreErrors: true }

interface PartialReference {
  name: string
  keyword: string
  quoted: boolean
  derived: boolean
  triggerRange: Range
  originRange: Range
}

export class DefinitionService {
  private parserService: ParserService
  private exists: (filePath: string) => boolean
  private read: (filePath: string) => string | null

  constructor(
    parserService: ParserService,
    exists: (filePath: string) => boolean = existsSync,
    read: (filePath: string) => string | null = filePath => {
      try {
        return readFileSync(filePath, "utf-8")
      } catch {
        return null
      }
    }
  ) {
    this.parserService = parserService
    this.exists = exists
    this.read = read
  }

  getDefinition(document: TextDocument, position: Position): LocationLink[] {
    const reference = this.referenceAt(document, position)

    if (!reference || !this.isStatic(reference)) return []

    const targetRange = Range.create(Position.create(0, 0), Position.create(0, 0))

    return this.resolve(pathFromUri(document.uri), reference.name).map(filePath => ({
      originSelectionRange: reference.originRange,
      targetUri: uriFromPath(filePath),
      targetRange,
      targetSelectionRange: targetRange,
    }))
  }

  getHover(document: TextDocument, position: Position): Hover | null {
    const reference = this.referenceAt(document, position)

    if (!reference) return null

    const documentPath = pathFromUri(document.uri)
    const lines: string[] = []

    if (!this.isStatic(reference)) {
      lines.push(`Herb can't resolve this ${reference.keyword} statically.`, "")

      if (reference.derived) {
        lines.push(
          `Rails derives the partial from \`to_partial_path\` on \`${reference.name}\` when the template renders.`,
          "",
          "Name the partial explicitly, with `object:` for a single record or `collection:` for many, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them:",
          "",
          "```erb",
          `<%= render partial: "path/to/partial", object: ${reference.name} %>`,
          "```"
        )
      } else if (reference.quoted) {
        lines.push(
          "The name is interpolated, so it's only known at runtime.",
          "",
          "Use a literal name and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them:",
          "",
          "```erb",
          `<%= render partial: "events/card" %>`,
          "```"
        )
      } else {
        lines.push(
          "The name comes from a variable or method call, so it's only known at runtime.",
          "",
          "Use a literal name and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them:",
          "",
          "```erb",
          `<%= render partial: "events/card" %>`,
          "```"
        )
      }
    } else {
      const resolved = this.resolve(documentPath, reference.name)

      if (resolved.length > 0) {
        lines.push(...resolved.map(filePath => `[${this.displayPath(filePath)}](${uriFromPath(filePath)})`))
        lines.push(...this.preview(resolved[0]))
      } else {
        lines.push(
          `No ${reference.keyword} found for \`${reference.name}\`.`,
          "",
          "Looked for:",
          ...this.expected(documentPath, reference.name).map(filePath => `- \`${this.displayPath(filePath)}\``)
        )
      }
    }

    return {
      contents: { kind: MarkupKind.Markdown, value: lines.join("\n") },
      range: reference.originRange,
    }
  }

  static asLocations(links: LocationLink[]): Location[] {
    return links.map(link => Location.create(link.targetUri, link.targetRange))
  }

  private isStatic(reference: PartialReference): boolean {
    return reference.quoted && PARTIAL_NAME.test(reference.name)
  }

  private referenceAt(document: TextDocument, position: Position): PartialReference | null {
    const result = this.parserService.parseContent(document.getText(), { render_nodes: true })
    const collector = new RenderCollector()

    collector.visit(result.value as DocumentNode)

    for (const render of collector.renders) {
      const reference = this.referenceFor(document, render)

      if (!reference) continue
      if (!isPositionInRange(position, reference.triggerRange)) continue

      return reference
    }

    return null
  }

  private referenceFor(document: TextDocument, render: ERBRenderNode): PartialReference | null {
    const keywords = render.keywords
    const partial = keywords?.partial ?? keywords?.layout
    const rendered = partial ?? keywords?.object ?? keywords?.collection

    if (!rendered) return null

    const range = lspRangeFromLocation(rendered.location)
    const quoted = QUOTE.test(rendered.value) || QUOTE.test(document.getText(range))
    const derived = !partial && !quoted

    const reference = {
      name: rendered.value,
      keyword: keywords?.layout && !keywords?.partial ? "layout" : "partial",
      quoted,
      derived,
      triggerRange: this.withKeyword(document, range),
      originRange: derived ? range : this.withoutQuotes(document, range),
    }

    if (this.isStatic(reference)) return reference

    const tagRange = this.tagRange(render)

    return { ...reference, triggerRange: tagRange ?? reference.triggerRange, originRange: tagRange ?? reference.originRange }
  }

  private tagRange(render: ERBRenderNode): Range | null {
    if (!render.tag_opening || !render.tag_closing) return null

    return Range.create(
      lspRangeFromLocation(render.tag_opening.location).start,
      lspRangeFromLocation(render.tag_closing.location).end
    )
  }

  private preview(filePath: string): string[] {
    const source = this.read(filePath)

    if (!source) return []

    const declaration = this.strictLocalsDeclaration(source)
    const body = this.outline(source)
    const parts: string[] = []

    if (declaration) parts.push(declaration)
    if (body.length > 0) parts.push(body.join("\n"))

    if (parts.length === 0) return []

    return ["", "```erb", parts.join("\n\n"), "```"]
  }

  private strictLocalsDeclaration(source: string): string | null {
    const result = this.parserService.parseContent(source, { strict_locals: true })
    const node = result.value.compactChildNodes().find(child => isERBStrictLocalsNode(child))

    if (!node) return null

    const lines = source.split("\n").slice(node.location.start.line - 1, node.location.end.line)

    return lines.join("\n").trim()
  }

  private outline(source: string): string[] {
    const result = this.parserService.parseContent(source, { strict_locals: true, track_whitespace: true })

    const nodes = result.value.compactChildNodes()
      .filter(child => !isERBStrictLocalsNode(child))
      .filter(child => !isPureWhitespaceNode(child))

    const node = nodes.at(0)

    if (!node) {
      return []
    }

    const outline = this.outlineFor(node)

    return nodes.length > 1 ? [...outline, "..."] : outline
  }

  private outlineFor(node: Node): string[] {
    const printed = IdentityPrinter.print(node, PRINT_OPTIONS).trimEnd().split("\n")

    if (printed.length <= SNIPPET_LINES) return printed

    const boundaries = this.boundaries(node)

    if (!boundaries) {
      return [...printed.slice(0, SNIPPET_LINES), "..."]
    }

    return [...boundaries[0].split("\n"), "  ...", ...boundaries[1].split("\n")]
  }

  private boundaries(node: Node): [string, string] | null {
    if (isHTMLElementNode(node)) {
      if (!node.open_tag || !node.close_tag) return null

      const openTag = IdentityPrinter.print(node.open_tag, PRINT_OPTIONS)
      const collapsed = openTag.includes("\n") || openTag.length > OPEN_TAG_WIDTH

      return [collapsed ? `<${getTagName(node)} …>` : openTag, IdentityPrinter.print(node.close_tag, PRINT_OPTIONS)]
    }

    const end = (node as { end_node?: Node }).end_node
    const tags = node as { tag_opening?: { value: string }, content?: { value: string }, tag_closing?: { value: string } }

    if (!end || !tags.tag_opening || !tags.tag_closing) {
      return null
    }

    return [`${tags.tag_opening.value}${tags.content?.value ?? ""}${tags.tag_closing.value}`, IdentityPrinter.print(end, PRINT_OPTIONS)]
  }

  private displayPath(filePath: string): string {
    const viewsRoot = this.viewsRoot(filePath)

    return viewsRoot ? path.relative(path.dirname(path.dirname(viewsRoot)), filePath) : path.basename(filePath)
  }

  private withKeyword(document: TextDocument, range: Range): Range {
    const before = document.getText(Range.create(Position.create(range.start.line, 0), range.start))
    const upToColon = before.trimEnd()

    if (!upToColon.endsWith(":")) return range

    const upToKeyword = upToColon.slice(0, -1).trimEnd()
    const keyword = PARTIAL_KEYWORDS.find(candidate => upToKeyword.endsWith(candidate))

    if (!keyword) {
      return range
    }

    const keywordStart = upToKeyword.length - keyword.length
    const characterBefore = upToKeyword[keywordStart - 1]

    if (characterBefore && IDENTIFIER_CHARACTER.test(characterBefore)) {
      return range
    }

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
    return this.candidates(documentPath, name).filter(candidate => this.exists(candidate))
  }

  private expected(documentPath: string, name: string): string[] {
    const extension = this.templateExtension(documentPath)

    return this.candidates(documentPath, name).filter(candidate => candidate.endsWith(`.${extension}`))
  }

  private candidates(documentPath: string, name: string): string[] {
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

    return [...new Set(
      directories.flatMap(directory => extensions.map(extension => path.join(directory, `_${base}.${extension}`)))
    )]
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
