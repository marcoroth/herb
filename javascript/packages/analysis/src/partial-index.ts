import { isERBStrictLocalsNode, isRubyParameterNode } from "@herb-tools/core"
import { PARTIAL_EXTENSIONS, partialNameForFile, resolvePartial } from "./partial-resolution"

import type { DocumentNode } from "@herb-tools/core"
import type { PartialPaths } from "./partial-resolution"
import type { CallSiteLocation } from "./render-graph-utils"

const KEYWORD_KIND = "keyword"
const KEYWORD_REST_KIND = "keyword_rest"
const VARIANT_RANK = PARTIAL_EXTENSIONS.length

export interface StrictLocal {
  name: string
  required: boolean
  defaultSource?: string
}

export interface PartialDeclaration {
  file: string
  hasDeclaration: boolean
  hasKeywordRest: boolean
  locals: StrictLocal[]
  location?: CallSiteLocation
}

export type PartialVariants = Map<string, Map<string, PartialDeclaration>>

export interface SerializedPartialIndex {
  viewRoot: string
  partials: Record<string, PartialDeclaration>
  variants?: Record<string, Record<string, PartialDeclaration>>
}

const VARIANT_SEPARATOR = "+"

function templateBasename(file: string): string {
  const separated = file.replace(/\\/g, "/")
  const separator = separated.lastIndexOf("/")

  return separator === -1 ? separated : separated.slice(separator + 1)
}

export function templateVariant(file: string | undefined): string | null {
  if (!file) return null

  const base = templateBasename(file)
  const start = base.indexOf(VARIANT_SEPARATOR)

  if (start === -1) return null

  const rest = base.slice(start + 1)
  const end = rest.indexOf(".")
  const variant = end === -1 ? rest : rest.slice(0, end)

  return variant === "" ? null : variant
}

function withoutVariant(file: string, variant: string): string {
  return templateBasename(file).replace(`${VARIANT_SEPARATOR}${variant}`, "")
}

function outranksVariant(candidate: string, incumbent: string, variant: string): boolean {
  const candidateRank = templateRank(withoutVariant(candidate, variant))
  const incumbentRank = templateRank(withoutVariant(incumbent, variant))

  if (candidateRank !== incumbentRank) return candidateRank < incumbentRank

  return candidate < incumbent
}

export function templateRank(file: string): number {
  const base = templateBasename(file)

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

export const STRICT_LOCALS_MARKER = "locals"

function locationOf(node: { location?: { start?: { line: number, column: number } } }): CallSiteLocation | undefined {
  const start = node.location?.start

  return start ? { line: start.line, column: start.column } : undefined
}

export function declarationWithoutStrictLocals(file: string): PartialDeclaration {
  return { file, hasDeclaration: false, hasKeywordRest: false, locals: [] }
}

export function declarationFromDocument(document: DocumentNode, file: string): PartialDeclaration {
  const declaration = declarationWithoutStrictLocals(file)

  for (const child of document.children) {
    if (!isERBStrictLocalsNode(child)) continue

    declaration.hasDeclaration = true
    declaration.location = declaration.location ?? locationOf(child)

    for (const local of child.locals) {
      if (!isRubyParameterNode(local)) continue

      if (local.kind === KEYWORD_REST_KIND) {
        declaration.hasKeywordRest = true
        continue
      }

      if (local.kind !== KEYWORD_KIND) continue

      const name = local.name?.value

      if (!name) continue

      const defaultSource = local.default_value?.content

      declaration.locals.push(defaultSource === undefined || defaultSource === null ? { name, required: local.required } : { name, required: local.required, defaultSource })
    }
  }

  return declaration
}

export class PartialIndex {
  readonly viewRoot: string

  private readonly declarations: Map<string, PartialDeclaration>
  private readonly variants: PartialVariants
  private readonly files: PartialPaths
  private readonly byFile: Map<string, PartialDeclaration>

  static from(data: SerializedPartialIndex): PartialIndex {
    const variants: PartialVariants = new Map()

    for (const [name, byVariant] of Object.entries(data.variants ?? {})) {
      variants.set(name, new Map(Object.entries(byVariant)))
    }

    return new PartialIndex(data.viewRoot, new Map(Object.entries(data.partials)), variants)
  }

  constructor(viewRoot: string, declarations: Map<string, PartialDeclaration>, variants: PartialVariants = new Map()) {
    this.viewRoot = viewRoot
    this.declarations = declarations
    this.variants = variants
    this.files = new Map()
    this.byFile = new Map()

    for (const [name, declaration] of declarations) {
      this.files.set(name, declaration.file)
      this.byFile.set(declaration.file, declaration)
      this.updateVariant(name, declaration)
    }
  }

  entries(): [string, PartialDeclaration][] {
    return [...this.declarations]
  }

  lookup(partialName: string, sourceFile: string | undefined): PartialDeclaration | null {
    const file = resolvePartial(partialName, sourceFile ?? "", this.files, this.viewRoot)

    if (file === null) return null

    const declaration = this.byFile.get(file) ?? null
    const variant = templateVariant(sourceFile)

    if (variant === null) return declaration

    const name = partialNameForFile(file, this.viewRoot)
    const matching = name === null ? undefined : this.variants.get(name)?.get(variant)

    return matching ?? declaration
  }

  update(declaration: PartialDeclaration): string | null {
    const name = partialNameForFile(declaration.file, this.viewRoot)
    if (name === null) return null

    const variantChanged = this.updateVariant(name, declaration)
    const existing = this.declarations.get(name)

    if (existing && existing.file !== declaration.file) {
      if (!outranksTemplate(declaration.file, existing.file)) return variantChanged ? name : null

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

    const variantRemoved = this.removeVariant(name, file)
    const existing = this.declarations.get(name)

    if (!existing || existing.file !== file) return variantRemoved ? name : null

    this.declarations.delete(name)
    this.files.delete(name)
    this.byFile.delete(file)

    return name
  }

  get size(): number {
    return this.declarations.size
  }

  toJSON(): SerializedPartialIndex {
    const variants: Record<string, Record<string, PartialDeclaration>> = {}

    for (const [name, byVariant] of this.variants) {
      variants[name] = Object.fromEntries(byVariant)
    }

    return { viewRoot: this.viewRoot, partials: Object.fromEntries(this.declarations), variants }
  }

  private updateVariant(name: string, declaration: PartialDeclaration): boolean {
    const variant = templateVariant(declaration.file)
    if (variant === null) return false

    const byVariant = this.variants.get(name) ?? new Map<string, PartialDeclaration>()
    const existing = byVariant.get(variant)

    if (existing && existing.file !== declaration.file && !outranksVariant(declaration.file, existing.file, variant)) return false

    byVariant.set(variant, declaration)
    this.variants.set(name, byVariant)

    return true
  }

  private removeVariant(name: string, file: string): boolean {
    const variant = templateVariant(file)
    if (variant === null) return false

    const byVariant = this.variants.get(name)
    if (byVariant?.get(variant)?.file !== file) return false

    byVariant.delete(variant)

    if (byVariant.size === 0) this.variants.delete(name)

    return true
  }
}
