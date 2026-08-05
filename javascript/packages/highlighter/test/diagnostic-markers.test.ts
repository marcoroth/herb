import { describe, it, expect } from "vitest"
import dedent from "dedent"

import { computeDiagnosticMarkers } from "../src/diagnostic-markers.js"

import type { SerializedLocation } from "@herb-tools/core"

const location = (startLine: number, startColumn: number, endLine: number, endColumn: number): SerializedLocation => ({
  start: { line: startLine, column: startColumn },
  end: { line: endLine, column: endColumn },
})

describe("computeDiagnosticMarkers", () => {
  it("returns a single marker for a single-line diagnostic", () => {
    const lines = dedent`
      <div>
        <span>content</span>
      </div>
    `.split("\n")

    expect(computeDiagnosticMarkers(location(2, 2, 2, 8), lines)).toEqual([
      { line: 2, start: 2, end: 8 },
    ])
  })

  it("returns a marker per line for a multi-line diagnostic", () => {
    const lines = dedent`
      <div id="gems">
        <% @gems.each do |topic_gem| %>
          <%= render partial: "gem_card" %>
        <% end %>
      </div>
    `.split("\n")

    expect(computeDiagnosticMarkers(location(2, 2, 4, 11), lines)).toEqual([
      { line: 2, start: 2, end: 33 },
      { line: 3, start: 4, end: 37 },
      { line: 4, start: 2, end: 11 },
    ])
  })

  it("marks intermediate lines across their non-whitespace content only", () => {
    const lines = dedent`
      <% if true %>
            indented${"      "}
      <% end %>
    `.split("\n")

    expect(computeDiagnosticMarkers(location(1, 0, 3, 9), lines)).toEqual([
      { line: 1, start: 0, end: 13 },
      { line: 2, start: 6, end: 14 },
      { line: 3, start: 0, end: 9 },
    ])
  })

  it("skips blank and whitespace-only lines inside the span", () => {
    const lines = dedent`
      <% if true %>

      ${"    "}
      <% end %>
    `.split("\n")

    const markers = computeDiagnosticMarkers(location(1, 0, 4, 9), lines)

    expect(markers.map(marker => marker.line)).toEqual([1, 4])
  })

  it("skips the last line when the diagnostic ends at its first column", () => {
    const lines = dedent`
      <% if true %>
        content
      <% end %>
    `.split("\n")

    const markers = computeDiagnosticMarkers(location(1, 0, 3, 0), lines)

    expect(markers.map(marker => marker.line)).toEqual([1, 2])
  })

  it("falls back to a single-character marker for a zero-width diagnostic", () => {
    const lines = dedent`
      <div>
        <span>
      </div>
    `.split("\n")

    expect(computeDiagnosticMarkers(location(2, 4, 2, 4), lines)).toEqual([
      { line: 2, start: 4, end: 5 },
    ])
  })

  it("clamps the end line to the available content", () => {
    const lines = dedent`
      <% if true %>
        content
    `.split("\n")

    const markers = computeDiagnosticMarkers(location(1, 0, 99, 5), lines)

    expect(markers.map(marker => marker.line)).toEqual([1, 2])
  })
})
