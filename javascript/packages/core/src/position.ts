export type SerializedPosition = {
  line: number
  column: number
}

export class Position {
  readonly line: number
  readonly column: number

  static from(position: SerializedPosition) {
    return new Position(position.line, position.column)
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
