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
