import { describe, test, expect } from "vitest"

import { Location, deserializeDiagnostic } from "../src/index.js"

import type { SerializedDiagnostic } from "../src/index.js"

const serialized: SerializedDiagnostic = {
  message: "Extra whitespace detected at end of line.",
  location: { start: { line: 2, column: 19 }, end: { line: 2, column: 20 } },
  severity: "error",
  code: "erb-no-trailing-whitespace",
  source: "Herb Linter"
}

describe("deserializeDiagnostic", () => {
  test("restores the Location instance", () => {
    const diagnostic = deserializeDiagnostic(serialized)

    expect(diagnostic.location).toBeInstanceOf(Location)
    expect(typeof diagnostic.location.toJSON).toBe("function")
  })

  test("preserves the location values", () => {
    const { location } = deserializeDiagnostic(serialized)

    expect(location.start.line).toBe(2)
    expect(location.start.column).toBe(19)
    expect(location.end.line).toBe(2)
    expect(location.end.column).toBe(20)
  })

  test("preserves the remaining fields", () => {
    const diagnostic = deserializeDiagnostic(serialized)

    expect(diagnostic.message).toBe(serialized.message)
    expect(diagnostic.severity).toBe("error")
    expect(diagnostic.code).toBe("erb-no-trailing-whitespace")
    expect(diagnostic.source).toBe("Herb Linter")
  })

  test("round-trips a structured clone, as it crosses a worker boundary", () => {
    const clone = structuredClone(serialized) as SerializedDiagnostic
    const diagnostic = deserializeDiagnostic(clone)

    expect(diagnostic.location).toBeInstanceOf(Location)
    expect(JSON.stringify(diagnostic.location)).toBe(JSON.stringify(Location.from(serialized.location)))
  })
})
