export type SerializedPosition = {
  line: number
  column: number
}

export class Position {
  readonly line: number
  readonly column: number

  static from(position: SerializedPosition): Position
  static from(line: number, column: number): Position
  static from(positionOrLine: SerializedPosition | number, column?: number): Position {
    if (typeof positionOrLine === "number") {
      return new Position(positionOrLine, column!)
    } else {
      return new Position(positionOrLine.line, positionOrLine.column)
    }
  }

  static get zero() {
    return new Position(0, 0)
  }

  constructor(line: number, column: number) {
    this.line = line
    this.column = column
  }

  compare(other: Position): number {
    if (this.line !== other.line) return this.line - other.line

    return this.column - other.column
  }

  isBefore(other: Position): boolean {
    return this.compare(other) < 0
  }

  isAfter(other: Position): boolean {
    return this.compare(other) > 0
  }

  equals(other: Position): boolean {
    return this.compare(other) === 0
  }

  toHash(): SerializedPosition {
    return { line: this.line, column: this.column }
  }

  toJSON(): SerializedPosition {
    return this.toHash()
  }

  treeInspect(): string {
    return `(${this.line}:${this.column})`
  }

  inspect(): string {
    return `#<Herb::Position ${this.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}

/**
 * Converts a character offset in a source string to a Position (line, column).
 * Lines are 1-based, columns are 0-based.
 *
 * @param source - The source string the offset is relative to
 * @param offset - A UTF-16 string index into `source`
 * @returns The Position at `offset`
 */
export function positionFromOffset(source: string, offset: number): Position {
  let line = 1
  let column = 0
  let currentOffset = 0

  for (let i = 0; i < source.length && currentOffset < offset; i++) {
    const char = source[i]
    currentOffset++

    if (char === "\n") {
      line++
      column = 0
    } else {
      column++
    }
  }

  return new Position(line, column)
}

/**
 * Converts a Position (line, column) to a character offset in a source string.
 * Lines are 1-based, columns are 0-based.
 *
 * @param source - The source string the position is relative to
 * @param position - The Position to resolve
 * @returns A UTF-16 string index into `source`, or `null` when the position falls outside of it
 */
export function offsetFromPosition(source: string, position: Position): number | null {
  if (position.line < 1 || position.column < 0) return null

  let line = 1
  let offset = 0

  while (line < position.line) {
    const newline = source.indexOf("\n", offset)

    if (newline === -1) return null

    offset = newline + 1
    line++
  }

  const lineEnd = source.indexOf("\n", offset)
  const lineLength = (lineEnd === -1 ? source.length : lineEnd) - offset

  if (position.column > lineLength) return null

  return offset + position.column
}

/**
 * Extracts the text between two Positions from a source string.
 *
 * @param source - The source string both positions are relative to
 * @param start - The Position to slice from
 * @param end - The Position to slice to
 * @returns The text between `start` and `end`, or `null` when either position falls outside of `source`
 */
export function sliceBetweenPositions(source: string, start: Position, end: Position): string | null {
  const from = offsetFromPosition(source, start)
  const to = offsetFromPosition(source, end)

  if (from === null || to === null || from > to) return null

  return source.slice(from, to)
}
