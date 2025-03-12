import { Location, SerializedLocation } from "./location.js"

export interface SerializedHerbWarning {
  message: string
  location: SerializedLocation
}

export class HerbWarning {
  message: string
  location: Location

  static from(warning: SerializedHerbWarning) {
    return new HerbWarning(warning.message, Location.from(warning.location))
  }

  constructor(message: string, location: Location) {
    this.message = message
    this.location = location
  }
}
