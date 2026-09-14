import { describe, test, expect } from "vitest"

import { Position, offsetFromPosition, positionFromOffset, sliceBetweenPositions } from "../src/position.js"

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

describe("offsetFromPosition", () => {
  const source = `<div class="x">\n  <span>text</span>\n</div>`

  test("resolves a position on the first line", () => {
    expect(offsetFromPosition(source, Position.from(1, 5))).toBe(5)
  })

  test("resolves a position on a later line", () => {
    expect(offsetFromPosition(source, Position.from(2, 2))).toBe(18)
  })

  test("resolves the end of a line", () => {
    expect(offsetFromPosition(source, Position.from(1, 15))).toBe(15)
  })

  test("round-trips with positionFromOffset", () => {
    for (let offset = 0; offset <= source.length; offset++) {
      expect(offsetFromPosition(source, positionFromOffset(source, offset))).toBe(offset)
    }
  })

  test("answers with null for a line past the end of the source", () => {
    expect(offsetFromPosition(source, Position.from(9, 0))).toBeNull()
  })

  test("answers with null for a column past the end of a line", () => {
    expect(offsetFromPosition(source, Position.from(2, 99))).toBeNull()
  })

  test("answers with null for a position before the start of the source", () => {
    expect(offsetFromPosition(source, Position.zero)).toBeNull()
    expect(offsetFromPosition(source, Position.from(1, -1))).toBeNull()
  })
})

describe("sliceBetweenPositions", () => {
  const source = `<span   class="x"\n  id="y">text</span>`

  test("extracts the text between two positions on one line", () => {
    expect(sliceBetweenPositions(source, Position.from(1, 5), Position.from(1, 8))).toBe("   ")
  })

  test("extracts the text across a line boundary", () => {
    expect(sliceBetweenPositions(source, Position.from(1, 17), Position.from(2, 2))).toBe("\n  ")
  })

  test("answers with an empty string for two identical positions", () => {
    expect(sliceBetweenPositions(source, Position.from(1, 5), Position.from(1, 5))).toBe("")
  })

  test("answers with null when the positions run backwards", () => {
    expect(sliceBetweenPositions(source, Position.from(2, 2), Position.from(1, 5))).toBeNull()
  })

  test("answers with null when either position falls outside the source", () => {
    expect(sliceBetweenPositions(source, Position.from(1, 5), Position.from(9, 0))).toBeNull()
    expect(sliceBetweenPositions(source, Position.from(9, 0), Position.from(1, 5))).toBeNull()
  })
})
