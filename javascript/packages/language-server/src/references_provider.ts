import { join } from "node:path"
import { readFileSync } from "node:fs"

import { isPartialPath } from "@herb-tools/analysis"
import { uriFromPath } from "@herb-tools/language-service"

import { Location, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Project } from "./project"
import { DefinitionProvider } from "@herb-tools/language-service"
import { Documents } from "./documents"

import type { PartialReference } from "@herb-tools/language-service"
import type { ProjectIndex } from "@herb-tools/analysis/node"

const LANGUAGE_ID = "erb"
const DECLARATION_RANGE = Range.create(Position.create(0, 0), Position.create(0, 0))

export class ReferencesProvider {
  private project: Project
  private definitionProvider: DefinitionProvider
  private index: ProjectIndex
  private documents: Documents
  private read: (filePath: string) => string | null

  constructor(
    project: Project,
    definitionProvider: DefinitionProvider,
    index: ProjectIndex,
    documents: Documents,
    read: (filePath: string) => string | null = filePath => {
      try {
        return readFileSync(filePath, "utf-8")
      } catch {
        return null
      }
    }
  ) {
    this.project = project
    this.definitionProvider = definitionProvider
    this.index = index
    this.documents = documents
    this.read = read
  }

  getReferences(document: TextDocument, position: Position, includeDeclaration: boolean): Location[] {
    const callers = this.index.callers
    if (!callers) return []

    const partial = this.partialAt(document, position)
    if (!partial) return []

    const current = this.index.relativePathFor(document.uri)
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
    const file = this.index.relativePathFor(document.uri)
    const reference = this.definitionProvider.referenceAt(document, position)

    if (!reference) return file && isPartialPath(document.uri) ? file : null
    if (!this.definitionProvider.isStatic(reference)) return null

    return this.resolve(reference, file)
  }

  private callSitesIn(file: string, partial: string, open: TextDocument | null): Location[] {
    const document = open ?? this.documentFor(file)

    if (!document) return []

    return this.definitionProvider.partialReferences(document)
      .filter(reference => this.definitionProvider.isStatic(reference))
      .filter(reference => this.resolve(reference, file) === partial)
      .map(reference => Location.create(document.uri, reference.originRange))
  }

  private documentFor(file: string): TextDocument | null {
    const uri = this.uriFor(file)

    const open = this.documents.get(uri)
    if (open) return open

    const source = this.read(join(this.project.root, file))

    return source === null ? null : TextDocument.create(uri, LANGUAGE_ID, 0, source)
  }

  private resolve(reference: PartialReference, file: string | null): string | null {
    return this.index.partials?.lookup(reference.name, file ?? undefined)?.file ?? null
  }

  private uriFor(file: string): string {
    return uriFromPath(join(this.project.root, file))
  }
}
