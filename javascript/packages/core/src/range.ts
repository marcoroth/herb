export type SerializedRange = [number, number]

export class Range {
  readonly start: number
  readonly end: number

  static from(range: SerializedRange): Range
  static from(start: number, end: number): Range
  static from(rangeOrStart: SerializedRange | number, end?: number): Range {
    if (typeof rangeOrStart === "number") {
      return new Range(rangeOrStart, end!)
    } else {
      return new Range(rangeOrStart[0], rangeOrStart[1])
    }
  }

  static get zero() {
    return new Range(0, 0)
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
