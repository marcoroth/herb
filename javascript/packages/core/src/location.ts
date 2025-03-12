import { Position } from "./position.js"
import type { SerializedPosition } from "./position.js"

export type SerializedLocation = {
  start: SerializedPosition
  end: SerializedPosition
}

export class Location {
  readonly start: Position
  readonly end: Position

  static from(location: SerializedLocation) {
    const start = Position.from(location.start)
    const end = Position.from(location.end)

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
    return `${this.start.treeInspect()}-${this.end.treeInspect()}`
  }

  treeInspectWithLabel(): string {
    return `(location: ${this.treeInspect()})`
  }

  inspect(): string {
    return `#<Herb::Location ${this.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}
