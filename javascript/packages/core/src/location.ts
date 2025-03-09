import { Position } from "./position.js"
import type { SerializedPosition } from "./position.js"

export type SerializedLocation = {
  start: SerializedPosition
  end: SerializedPosition
}

export class Location {
  readonly start: Position
  readonly end: Position

  static fromSerialized(location: SerializedLocation) {
    const start = Position.fromSerialized(location.start)
    const end = Position.fromSerialized(location.end)

    return new Location(start, end)
  }

  constructor(start: Position, end: Position) {
    this.start = start
    this.end = end
  }

  toHash(): SerializedLocation {
    return {
      start: this.start.toHash(),
      end: this.end.toHash(),
    }
  }

  toJSON(): SerializedLocation {
    return this.toHash()
  }

  treeInspect(): string {
    return `(location: ${this.start.treeInspect()}:${this.end.treeInspect()})`
  }

  inspect(): string {
    return `#<Position ${this.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
