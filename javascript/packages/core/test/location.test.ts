import { describe, test, expect } from "vitest"

import { Location } from "../src/location.js"
import { Position } from "../src/position.js"

describe("Location", () => {
  describe("contains", () => {
    test("answers for a position inside it", () => {
      expect(Location.from(1, 0, 1, 5).contains(Position.from(1, 3))).toBe(true)
    })

    test("answers for its own start", () => {
      expect(Location.from(1, 0, 1, 5).contains(Position.from(1, 0))).toBe(true)
    })

    test("does not answer for its own end", () => {
      expect(Location.from(1, 0, 1, 5).contains(Position.from(1, 5))).toBe(false)
    })

    test("does not answer for a position before it", () => {
      expect(Location.from(1, 2, 1, 5).contains(Position.from(1, 1))).toBe(false)
    })

    test("spans lines", () => {
      const location = Location.from(1, 4, 3, 2)

      expect(location.contains(Position.from(2, 0))).toBe(true)
      expect(location.contains(Position.from(3, 1))).toBe(true)
      expect(location.contains(Position.from(3, 2))).toBe(false)
      expect(location.contains(Position.from(1, 3))).toBe(false)
    })
  })

  describe("covers", () => {
    test("answers for a location inside it", () => {
      expect(Location.from(1, 0, 3, 0).covers(Location.from(2, 0, 2, 4))).toBe(true)
    })

    test("answers for itself", () => {
      expect(Location.from(1, 0, 3, 0).covers(Location.from(1, 0, 3, 0))).toBe(true)
    })

    test("does not answer for a location that reaches past it", () => {
      expect(Location.from(1, 0, 3, 0).covers(Location.from(2, 0, 4, 0))).toBe(false)
    })
  })

  describe("isEmpty", () => {
    test("answers for a zero location", () => {
      expect(Location.zero.isEmpty()).toBe(true)
    })

    test("answers for any location that starts where it ends", () => {
      expect(Location.from(2, 7, 2, 7).isEmpty()).toBe(true)
    })

    test("does not answer for a location that spans a character", () => {
      expect(Location.from(2, 7, 2, 8).isEmpty()).toBe(false)
    })
  })
})
