export type SerializedRange = [number, number]

export class Range {
  readonly start: number
  readonly end: number

  static from(range: SerializedRange) {
    return new Range(range[0], range[1])
  }

  constructor(start: number, end: number) {
    this.start = start
    this.end = end
  }

  toArray(): SerializedRange {
    return [this.start, this.end]
  }

  toJSON(): SerializedRange {
    return this.toArray()
  }

  treeInspect(): string {
    return `[${this.start}, ${this.end}]`
  }

  inspect(): string {
    return `#<Herb::Range ${this.toArray()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
