import type { Location as HerbLocation } from "@herb-tools/core"

export type LineOffsetTable = number[]

export interface OffsetRange {
  start: number
  end: number
}

export function buildLineOffsetTable(source: string): LineOffsetTable {
  const offsets: number[] = [0, 0]

  for (let index = 0; index < source.length; index++) {
    if (source[index] === "\n") {
      offsets.push(index + 1)
    }
  }

  return offsets
}

export function positionToOffset(line: number, column: number, lineOffsets: LineOffsetTable): number {
  if (line < 1 || line >= lineOffsets.length) {
    return 0
  }

  return lineOffsets[line] + column
}

export function locationToOffsets(location: HerbLocation, lineOffsets: LineOffsetTable): OffsetRange {
  return {
    start: positionToOffset(location.start.line, location.start.column, lineOffsets),
    end: positionToOffset(location.end.line, location.end.column, lineOffsets),
  }
}
