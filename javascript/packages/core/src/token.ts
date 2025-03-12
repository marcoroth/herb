import { Range, SerializedRange } from "./range.js"
import { Location, SerializedLocation } from "./location.js"

export type SerializedToken = {
  value: string
  range: SerializedRange
  location: SerializedLocation
  type: string
}

export class Token {
  readonly value: string
  readonly range: Range
  readonly location: Location
  readonly type: string

  static from(token: SerializedToken) {
    return new Token(
      token.value,
      Range.from(token.range),
      Location.from(token.location),
      token.type,
    )
  }

  constructor(value: string, range: Range, location: Location, type: string) {
    this.value = value
    this.range = range
    this.location = location
    this.type = type
  }

  toHash(): SerializedToken {
    return {
      value: this.value,
      range: this.range?.toArray(),
      location: this.location?.toHash(),
      type: this.type,
    }
  }

  toJSON(): SerializedToken {
    return this.toHash()
  }

  treeInspect(): string {
    return `"${this.value}" ${this.location.treeInspectWithLabel()}`
  }

  inspect(): string {
    return `#<Herb::Token type="${this.type}" value=${JSON.stringify(this.value)} range=${this.range.treeInspect()} start=${this.location.start.treeInspect()} end=${this.location.end.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
