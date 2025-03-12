import { Location, SerializedLocation } from "./location.js"
import { fromSerializedError } from "./errors.js"

export interface SerializedHerbError {
  type: string
  message: string
  location: SerializedLocation
}

export abstract class HerbError {
  readonly type: string
  readonly message: string
  readonly location: Location

  static from(error: SerializedHerbError): HerbError {
    return fromSerializedError(error)
  }

  constructor(type: string, message: string, location: Location) {
    this.type = type
    this.message = message
    this.location = location
  }

  toJSON(): SerializedHerbError {
    return {
      type: this.type,
      message: this.message,
      location: this.location.toJSON(),
    }
  }

  inspect(): string {
    return this.treeInspect(0)
  }

  abstract treeInspect(indent?: number): string
}
