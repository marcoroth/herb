export type SerializedRange = [number, number]

export class Range {
  readonly from: number
  readonly to: number

  static from(range: SerializedRange): Range
  static from(from: number, to: number): Range
  static from(rangeOrFrom: SerializedRange | number, to?: number): Range {
    if (typeof rangeOrFrom === "number") {
      return new Range(rangeOrFrom, to!)
    } else {
      return new Range(rangeOrFrom[0], rangeOrFrom[1])
    }
  }

  static fromOptional(range: SerializedRange | null): Range {
    return (range ? Range.from(range) : null) as unknown as Range
  }

  static get zero() {
    return new Range(0, 0)
  }

  constructor(from: number, to: number) {
    this.from = from
    this.to = to
  }

  toArray(): SerializedRange {
    return [this.from, this.to]
  }

  toJSON(): SerializedRange {
    return this.toArray()
  }

  treeInspect(): string {
    return `[${this.from}, ${this.to}]`
  }

  inspect(): string {
    return `#<Herb::Range ${this.toArray()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
