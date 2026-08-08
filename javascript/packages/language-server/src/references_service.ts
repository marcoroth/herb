import { readFileSync } from "node:fs"
import { join } from "node:path"

import { isPartialPath } from "@herb-tools/core"
import { uriFromPath } from "./utils"

import { Location, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Project } from "./project"
import { DefinitionService } from "./definition_service"
import { PartialCallerIndexService } from "./partial_caller_index_service"
import { PartialIndexService } from "./partial_index_service"
import { DocumentService } from "./document_service"

import type { PartialReference } from "./definition_service"

const LANGUAGE_ID = "erb"
const DECLARATION_RANGE = Range.create(Position.create(0, 0), Position.create(0, 0))

export class ReferencesService {
  private project: Project
  private definitionService: DefinitionService
  private partialIndexService: PartialIndexService
  private partialCallerIndexService: PartialCallerIndexService
  private documentService: DocumentService
  private read: (filePath: string) => string | null

  constructor(
    project: Project,
    definitionService: DefinitionService,
    partialIndexService: PartialIndexService,
    partialCallerIndexService: PartialCallerIndexService,
    documentService: DocumentService,
    read: (filePath: string) => string | null = filePath => {
      try {
        return readFileSync(filePath, "utf-8")
      } catch {
        return null
      }
    }
  ) {
    this.project = project
    this.definitionService = definitionService
    this.partialIndexService = partialIndexService
    this.partialCallerIndexService = partialCallerIndexService
    this.documentService = documentService
    this.read = read
  }

  getReferences(document: TextDocument, position: Position, includeDeclaration: boolean): Location[] {
    const callers = this.partialCallerIndexService.index
    if (!callers) return []

    const partial = this.partialAt(document, position)
    if (!partial) return []

    const current = this.partialIndexService.relativePathFor(document.uri)
    const uriFor = (file: string) => file === current ? document.uri : this.uriFor(file)

    const locations = includeDeclaration ? [Location.create(uriFor(partial), DECLARATION_RANGE)] : []
    const allFiles = callers.callersOf(partial).filter(callSite => (callSite.via ?? "render") === "render").map(callSite => callSite.caller)

    const files = [...new Set(allFiles)].sort()

    for (const file of files) {
      locations.push(...this.callSitesIn(file, partial, file === current ? document : null))
    }

    return locations
  }

  private partialAt(document: TextDocument, position: Position): string | null {
    const file = this.partialIndexService.relativePathFor(document.uri)
    const reference = this.definitionService.referenceAt(document, position)

    if (!reference) return file && isPartialPath(document.uri) ? file : null
    if (!this.definitionService.isStatic(reference)) return null

    return this.resolve(reference, file)
  }

  private callSitesIn(file: string, partial: string, open: TextDocument | null): Location[] {
    const document = open ?? this.documentFor(file)

    if (!document) return []

    return this.definitionService.partialReferences(document)
      .filter(reference => this.definitionService.isStatic(reference))
      .filter(reference => this.resolve(reference, file) === partial)
      .map(reference => Location.create(document.uri, reference.originRange))
  }

  private documentFor(file: string): TextDocument | null {
    const uri = this.uriFor(file)

    const open = this.documentService.get(uri)
    if (open) return open

    const source = this.read(join(this.project.projectPath, file))

    return source === null ? null : TextDocument.create(uri, LANGUAGE_ID, 0, source)
  }

  private resolve(reference: PartialReference, file: string | null): string | null {
    return this.partialIndexService.index?.lookup(reference.name, file ?? undefined)?.file ?? null
  }

  private uriFor(file: string): string {
    return uriFromPath(join(this.project.projectPath, file))
  }
}
