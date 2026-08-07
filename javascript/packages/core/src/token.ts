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

  static from(token: SerializedToken): Token
  static from(type: string, value: string): Token
  static from(tokenOrType: SerializedToken | string, value?: string): Token {
    if (typeof tokenOrType === "string") {
      return new Token(value!, Range.zero, Location.zero, tokenOrType)
    }

    return new Token(
      tokenOrType.value,
      Range.from(tokenOrType.range),
      Location.from(tokenOrType.location),
      tokenOrType.type,
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

  valueInspect(): string {
    return this.type === "TOKEN_EOF"
      ? JSON.stringify("<EOF>")
      : JSON.stringify(this.value)
  }

  inspect(): string {
    return `#<Herb::Token type="${this.type}" value=${this.valueInspect()} range=${this.range.treeInspect()} start=${this.location.start.treeInspect()} end=${this.location.end.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
