import { readFileSync } from "node:fs"
import { join } from "node:path"

import { glob } from "tinyglobby"

import { PARTIAL_GLOB_PATTERN, partialNameForFile } from "@herb-tools/core"

import { PartialIndex, declarationFromDocument, outranksTemplate } from "../partial-index.js"

import type { HerbBackend } from "@herb-tools/core"
import type { PartialDeclaration, SerializedPartialIndex } from "../partial-index.js"

const VIEW_ROOT_CANDIDATE = "app/views"
const PROJECT_ROOT = "."

const PARSER_OPTIONS = { strict_locals: true } as const

function partialsIn(projectPath: string, viewRoot: string): Promise<string[]> {
  const pattern = viewRoot === PROJECT_ROOT ? `**/${PARTIAL_GLOB_PATTERN}` : `${viewRoot}/**/${PARTIAL_GLOB_PATTERN}`

  return glob([pattern], { cwd: projectPath, onlyFiles: true, dot: false, absolute: false })
}

export async function findViewRoot(projectPath: string): Promise<string> {
  const matches = await partialsIn(projectPath, VIEW_ROOT_CANDIDATE)

  return matches.length > 0 ? VIEW_ROOT_CANDIDATE : PROJECT_ROOT
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

    try {
      const result = herb.parse(readFileSync(join(projectPath, file), "utf-8"), PARSER_OPTIONS)

      declarations.set(name, declarationFromDocument(result.value, file))
    } catch {
      continue
    }
  }

  return new PartialIndex(viewRoot, declarations)
}

export function partialIndexFrom(data: SerializedPartialIndex | undefined): PartialIndex | undefined {
  return data ? PartialIndex.from(data) : undefined
}
