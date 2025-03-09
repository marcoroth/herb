export class Range {
  readonly start: number
  readonly end: number

  constructor(start: number, end: number) {
    this.start = start
    this.end = end
  }

  toArray(): number[] {
    return [this.start, this.end]
  }

  toJSON(): number[] {
    return this.toArray()
  }

  treeInspect(): string {
    return this.toArray().toString()
  }

  inspect(): string {
    return `#<Range ${this.toArray()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
