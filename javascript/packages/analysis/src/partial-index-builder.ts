import { join } from "node:path"
import { glob } from "tinyglobby"
import { readFileSync } from "node:fs"
import { PartialIndex, STRICT_LOCALS_MARKER, declarationFromDocument, declarationWithoutStrictLocals, outranksTemplate } from "./partial-index"
import { PARTIAL_GLOB_PATTERN, TEMPLATE_GLOB_PATTERN, isPartialPath, partialNameForFile } from "./partial-resolution"

import type { HerbBackend } from "@herb-tools/core"
import type { PartialDeclaration, SerializedPartialIndex } from "./partial-index"

const VIEW_ROOT_CANDIDATE = "app/views"
const PROJECT_ROOT = "."
const PARSER_OPTIONS = { strict_locals: true } as const

function filesIn(projectPath: string, viewRoot: string, filePattern: string): Promise<string[]> {
  const pattern = viewRoot === PROJECT_ROOT ? `**/${filePattern}` : `${viewRoot}/**/${filePattern}`

  return glob([pattern], { cwd: projectPath, onlyFiles: true, dot: false, absolute: false })
}

function partialsIn(projectPath: string, viewRoot: string): Promise<string[]> {
  return filesIn(projectPath, viewRoot, PARTIAL_GLOB_PATTERN)
}

export async function findViewRoot(projectPath: string): Promise<string> {
  const matches = await filesIn(projectPath, VIEW_ROOT_CANDIDATE, TEMPLATE_GLOB_PATTERN)

  return matches.length > 0 ? VIEW_ROOT_CANDIDATE : PROJECT_ROOT
}

export function declarationFromSource(herb: HerbBackend, file: string, source: string): PartialDeclaration {
  if (!source.includes(STRICT_LOCALS_MARKER)) return declarationWithoutStrictLocals(file)

  return declarationFromDocument(herb.parse(source, PARSER_OPTIONS).value, file)
}

export function declarationFromFile(herb: HerbBackend, projectPath: string, file: string): PartialDeclaration | null {
  try {
    return declarationFromSource(herb, file, readFileSync(join(projectPath, file), "utf-8"))
  } catch {
    return null
  }
}

export async function buildPartialIndex(herb: HerbBackend, projectPath: string): Promise<PartialIndex> {
  const viewRoot = await findViewRoot(projectPath)
  const files = await partialsIn(projectPath, viewRoot)
  const declarations = new Map<string, PartialDeclaration>()

  for (const file of files.sort()) {
    const name = partialNameForFile(file, viewRoot)
    if (name === null) continue

    const existing = declarations.get(name)
    if (existing && !outranksTemplate(file, existing.file)) continue

    const declaration = declarationFromFile(herb, projectPath, file)

    if (declaration) declarations.set(name, declaration)
  }

  return new PartialIndex(viewRoot, declarations)
}

export function partialIndexFrom(data: SerializedPartialIndex | undefined): PartialIndex | undefined {
  return data ? PartialIndex.from(data) : undefined
}

export function refreshPartialAfterFix(herb: HerbBackend, index: PartialIndex | undefined, file: string, before: string, after: string): boolean {
  if (!index) return false
  if (!isPartialPath(file)) return false

  const previous = declarationFromSource(herb, file, before)
  const current = declarationFromSource(herb, file, after)

  if (declarationsMatch(previous, current)) return false

  return index.update(current) !== null
}

function declarationsMatch(a: PartialDeclaration, b: PartialDeclaration): boolean {
  if (a.hasDeclaration !== b.hasDeclaration) return false
  if (a.hasKeywordRest !== b.hasKeywordRest) return false
  if (a.locals.length !== b.locals.length) return false

  return a.locals.every((local, index) => local.name === b.locals[index].name && local.required === b.locals[index].required)
}
