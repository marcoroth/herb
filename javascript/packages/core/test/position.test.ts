import { describe, test, expect } from "vitest"

import { Position } from "../src/position.js"

describe("Position", () => {
  describe("compare", () => {
    test("orders by line first", () => {
      expect(Position.from(1, 99).compare(Position.from(2, 0))).toBeLessThan(0)
    })

    test("orders by column within a line", () => {
      expect(Position.from(1, 4).compare(Position.from(1, 9))).toBeLessThan(0)
    })

    test("answers with zero for two positions on the same character", () => {
      expect(Position.from(3, 2).compare(Position.from(3, 2))).toBe(0)
    })

    test("sorts a list the way it reads", () => {
      const positions = [Position.from(2, 0), Position.from(1, 9), Position.from(1, 4)]
      const sorted = positions.sort((a, b) => a.compare(b))

      expect(sorted.map((position) => [position.line, position.column])).toEqual([
        [1, 4],
        [1, 9],
        [2, 0],
      ])
    })
  })

  describe("isBefore, isAfter and equals", () => {
    test("read the comparison", () => {
      const earlier = Position.from(1, 4)
      const later = Position.from(1, 9)

      expect(earlier.isBefore(later)).toBe(true)
      expect(later.isAfter(earlier)).toBe(true)
      expect(earlier.equals(Position.from(1, 4))).toBe(true)
      expect(earlier.equals(later)).toBe(false)
    })
  })
})
