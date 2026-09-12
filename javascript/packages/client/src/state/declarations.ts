import { literal } from "./conditions"

import type { StateValue } from "./values"
import type { StateComparand } from "./types"
import type { DiagnosticSpot } from "../shared/types"
import type { DeclaredState, StateManifest } from "./types"

export function declared(manifest: StateManifest, name: string, collection: number | null): DeclaredState | null {
  const exact = manifest.declarations.find((declaration) => {
    if (declaration.name !== name) {
      return false
    }

    if (collection === null) {
      return declaration.scope === "region"
    }

    return declaration.scope === collection
  })

  if (exact) {
    return exact
  }

  if (collection === null) {
    return null
  }

  return manifest.declarations.find((declaration) => declaration.name === name && declaration.scope === "region") ?? null
}

export function declarationSpot(declaration: DeclaredState): DiagnosticSpot {
  if (declaration.line === undefined || declaration.line === null) {
    return {}
  }

  return { location: { start: { line: declaration.line, column: declaration.column ?? 0 } } }
}

export function declaredValue(declaration: DeclaredState): StateValue | undefined {
  if (declaration.value !== undefined) {
    return declaration.value
  }

  return literal(declaration.default)
}

export function comparandLiteral(comparand: StateComparand): StateValue | undefined {
  if (comparand === null || typeof comparand !== "object") {
    return typeof comparand === "string" ? literal(comparand) : undefined
  }

  if ("state" in comparand) {
    return undefined
  }

  return comparand.value
}
