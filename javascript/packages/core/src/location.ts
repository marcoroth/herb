import { Position } from "./position.js"
import type { SerializedPosition } from "./position.js"

export type SerializedLocation = {
  start: SerializedPosition
  end: SerializedPosition
}

export class Location {
  readonly start: Position
  readonly end: Position

  static from(location: SerializedLocation): Location
  static from(line: number, column: number, endLine: number, endColumn: number): Location
  static from(locationOrLine: SerializedLocation | number, column?: number, endLine?: number, endColumn?: number): Location {
    if (typeof locationOrLine === "number") {
      const start = Position.from(locationOrLine, column!)
      const end = Position.from(endLine!, endColumn!)

      return new Location(start, end)
    } else {
      const start = Position.from(locationOrLine.start)
      const end = Position.from(locationOrLine.end)

      return new Location(start, end)
    }
  }

  static get zero() {
    return new Location(Position.zero, Position.zero)
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
