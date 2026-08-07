import { PARTIAL_EXTENSIONS, isERBStrictLocalsNode, isRubyParameterNode, partialNameForFile, resolvePartial } from "@herb-tools/core"

import type { DocumentNode, PartialPaths } from "@herb-tools/core"

const KEYWORD_KIND = "keyword"
const KEYWORD_REST_KIND = "keyword_rest"
const VARIANT_RANK = PARTIAL_EXTENSIONS.length

export interface StrictLocal {
  name: string
  required: boolean
}

export interface PartialDeclaration {
  file: string
  hasDeclaration: boolean
  hasKeywordRest: boolean
  locals: StrictLocal[]
}

export interface SerializedPartialIndex {
  viewRoot: string
  partials: Record<string, PartialDeclaration>
}

export function templateRank(file: string): number {
  const separated = file.replace(/\\/g, "/")
  const separator = separated.lastIndexOf("/")
  const base = separator === -1 ? separated : separated.slice(separator + 1)
  const dot = base.indexOf(".")

  if (dot === -1) return VARIANT_RANK

  const rank = PARTIAL_EXTENSIONS.indexOf(base.slice(dot) as typeof PARTIAL_EXTENSIONS[number])

  return rank === -1 ? VARIANT_RANK : rank
}

export function outranksTemplate(candidate: string, incumbent: string): boolean {
  const candidateRank = templateRank(candidate)
  const incumbentRank = templateRank(incumbent)

  if (candidateRank !== incumbentRank) return candidateRank < incumbentRank

  return candidate < incumbent
}

export function declarationFromDocument(document: DocumentNode, file: string): PartialDeclaration {
  const declaration: PartialDeclaration = { file, hasDeclaration: false, hasKeywordRest: false, locals: [] }

  for (const child of document.children) {
    if (!isERBStrictLocalsNode(child)) continue

    declaration.hasDeclaration = true

    for (const local of child.locals) {
      if (!isRubyParameterNode(local)) continue

      if (local.kind === KEYWORD_REST_KIND) {
        declaration.hasKeywordRest = true
        continue
      }

      if (local.kind !== KEYWORD_KIND) continue

      const name = local.name?.value

      if (name) declaration.locals.push({ name, required: local.required })
    }
  }

  return declaration
}

export class PartialIndex {
  readonly viewRoot: string

  private readonly declarations: Map<string, PartialDeclaration>
  private readonly files: PartialPaths
  private readonly byFile: Map<string, PartialDeclaration>

  static from(data: SerializedPartialIndex): PartialIndex {
    return new PartialIndex(data.viewRoot, new Map(Object.entries(data.partials)))
  }

  constructor(viewRoot: string, declarations: Map<string, PartialDeclaration>) {
    this.viewRoot = viewRoot
    this.declarations = declarations
    this.files = new Map()
    this.byFile = new Map()

    for (const [name, declaration] of declarations) {
      this.files.set(name, declaration.file)
      this.byFile.set(declaration.file, declaration)
    }
  }

  lookup(partialName: string, sourceFile: string | undefined): PartialDeclaration | null {
    const file = resolvePartial(partialName, sourceFile ?? "", this.files, this.viewRoot)

    if (file === null) return null

    return this.byFile.get(file) ?? null
  }

  update(declaration: PartialDeclaration): string | null {
    const name = partialNameForFile(declaration.file, this.viewRoot)

    if (name === null) return null

    const existing = this.declarations.get(name)

    if (existing && existing.file !== declaration.file) {
      if (!outranksTemplate(declaration.file, existing.file)) return null

      this.byFile.delete(existing.file)
    }

    this.declarations.set(name, declaration)
    this.files.set(name, declaration.file)
    this.byFile.set(declaration.file, declaration)

    return name
  }

  remove(file: string): string | null {
    const name = partialNameForFile(file, this.viewRoot)

    if (name === null) return null

    const existing = this.declarations.get(name)

    if (!existing || existing.file !== file) return null

    this.declarations.delete(name)
    this.files.delete(name)
    this.byFile.delete(file)

    return name
  }

  get size(): number {
    return this.declarations.size
  }

  toJSON(): SerializedPartialIndex {
    return { viewRoot: this.viewRoot, partials: Object.fromEntries(this.declarations) }
  }
}
