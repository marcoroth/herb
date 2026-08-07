import { existsSync } from "fs"
import { posix as path } from "path"

import { CodeAction, CodeActionKind, CreateFile, OptionalVersionedTextDocumentIdentifier, Range, TextDocumentEdit, TextEdit, WorkspaceEdit } from "vscode-languageserver/node"

import { ExtractPartialAnalyzer } from "./extract_partial_analyzer"
import { pathFromUri, uriFromPath } from "./utils"
import { ParserService } from "./parser_service"

import type { TextDocument } from "vscode-languageserver-textdocument"
import type { ExtractedLocal } from "./extract_partial_analyzer"

const VIEWS_DIRECTORY = "/app/views/"
const DEFAULT_TEMPLATE_EXTENSION = "html.erb"
const EXTRACT_TO_PARTIAL_COMMAND = "herb.extractToPartial"
const SEGMENT_NAME = /^[a-zA-Z0-9_-]+$/

export interface ExtractCodeActionCapabilities {
  supportsCreateFile: boolean
  supportsPromptCommand: boolean
}

export interface ExtractToPartialArguments {
  uri: string
  range: Range
  suggestedName: string
  locals: string[]
}

export interface ExtractToPartialSuccess {
  edit: WorkspaceEdit
  uri: string
  renderKey: string
}

export interface ExtractToPartialFailure {
  error: string
}

export type ExtractToPartialResult = ExtractToPartialSuccess | ExtractToPartialFailure

interface PartialTarget {
  path: string
  uri: string
  renderKey: string
}

export function isExtractToPartialFailure(result: ExtractToPartialResult): result is ExtractToPartialFailure {
  return "error" in result
}

export class ExtractCodeActionService {
  private analyzer: ExtractPartialAnalyzer
  private capabilities: ExtractCodeActionCapabilities

  constructor(parserService: ParserService, capabilities: ExtractCodeActionCapabilities) {
    this.analyzer = new ExtractPartialAnalyzer(parserService)
    this.capabilities = capabilities
  }

  getCodeActions(document: TextDocument, requestedRange: Range): CodeAction[] {
    if (!this.capabilities.supportsCreateFile) return []
    if (!this.isTemplate(document.uri)) return []

    const analysis = this.analyzer.analyze(document, requestedRange)

    if (!analysis) return []

    if (this.capabilities.supportsPromptCommand) {
      const argument: ExtractToPartialArguments = {
        uri: document.uri,
        range: analysis.range,
        suggestedName: analysis.suggestedName,
        locals: analysis.locals.map(local => local.name),
      }

      return [{
        title: "Herb: Extract to partial…",
        kind: CodeActionKind.RefactorExtract,
        command: {
          title: "Extract to partial",
          command: EXTRACT_TO_PARTIAL_COMMAND,
          arguments: [argument],
        },
      }]
    }

    const result = this.extractToPartial(document, requestedRange, analysis.suggestedName)

    if (isExtractToPartialFailure(result)) return []

    return [{
      title: `Herb: Extract to partial \`${result.renderKey}\``,
      kind: CodeActionKind.RefactorExtract,
      edit: result.edit,
    }]
  }

  extractToPartial(document: TextDocument, requestedRange: Range, name: string): ExtractToPartialResult {
    const analysis = this.analyzer.analyze(document, requestedRange)

    if (!analysis) {
      return { error: "The selection can't be extracted into a partial." }
    }

    const target = this.resolveTarget(document.uri, name)

    if (!target) {
      return { error: `\`${name}\` isn't a valid partial name.` }
    }

    if (existsSync(target.path)) {
      return { error: `\`${this.relativePath(document.uri, target.path)}\` already exists.` }
    }

    const partialDocument = OptionalVersionedTextDocumentIdentifier.create(target.uri, null)
    const sourceDocument = OptionalVersionedTextDocumentIdentifier.create(document.uri, null)

    const createFile: CreateFile = {
      kind: "create",
      uri: target.uri,
      options: { overwrite: false, ignoreIfExists: false },
    }

    const edit: WorkspaceEdit = {
      documentChanges: [
        createFile,
        TextDocumentEdit.create(partialDocument, [
          TextEdit.insert({ line: 0, character: 0 }, analysis.source)
        ]),
        TextDocumentEdit.create(sourceDocument, [
          TextEdit.replace(analysis.range, this.renderCall(target.renderKey, analysis.locals))
        ]),
      ],
    }

    return { edit, uri: target.uri, renderKey: target.renderKey }
  }

  private renderCall(renderKey: string, locals: ExtractedLocal[]): string {
    if (locals.length === 0) return `<%= render partial: "${renderKey}" %>`

    const assignments = locals.map(local => `${local.name}: ${local.expression}`).join(", ")

    return `<%= render partial: "${renderKey}", locals: { ${assignments} } %>`
  }

  private resolveTarget(documentUri: string, name: string): PartialTarget | null {
    const documentPath = pathFromUri(documentUri)
    const normalized = this.normalizeName(name)

    if (!normalized) return null

    const segments = normalized.split("/")
    const base = segments.pop()!
    const fileName = `_${base}.${this.templateExtension(documentPath)}`
    const documentDirectory = path.dirname(documentPath)
    const viewsRoot = this.viewsRoot(documentPath)

    const directory = segments.length > 0
      ? path.join(viewsRoot ?? documentDirectory, ...segments)
      : documentDirectory

    const prefix = viewsRoot ? path.relative(viewsRoot, directory).split("/").filter(Boolean) : segments
    const targetPath = path.join(directory, fileName)

    return {
      path: targetPath,
      uri: uriFromPath(targetPath),
      renderKey: [...prefix, base].join("/"),
    }
  }

  private normalizeName(name: string): string | null {
    const segments = name.trim().split("/").filter(segment => segment.length > 0 && segment !== ".")
    const base = segments.pop()?.replace(/^_/, "").split(".")[0]

    if (!base) return null
    if (!SEGMENT_NAME.test(base)) return null
    if (!segments.every(segment => SEGMENT_NAME.test(segment))) return null

    return [...segments, base].join("/")
  }

  private viewsRoot(documentPath: string): string | null {
    const index = documentPath.lastIndexOf(VIEWS_DIRECTORY)

    if (index === -1) return null

    return documentPath.slice(0, index + VIEWS_DIRECTORY.length - 1)
  }

  private templateExtension(documentPath: string): string {
    const [, ...extensions] = path.basename(documentPath).split(".")

    return extensions.length > 0 ? extensions.join(".") : DEFAULT_TEMPLATE_EXTENSION
  }

  private relativePath(documentUri: string, targetPath: string): string {
    const viewsRoot = this.viewsRoot(pathFromUri(documentUri))

    return viewsRoot ? path.relative(path.dirname(viewsRoot), targetPath) : path.basename(targetPath)
  }

  private isTemplate(uri: string): boolean {
    return uri.endsWith(".erb")
  }
}

