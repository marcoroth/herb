import { describe, test, expect } from "vitest"

import { SourceOffsets } from "../src/source-offsets.js"
import { Location } from "../src/location.js"
import { Position, offsetFromPosition, positionFromOffset } from "../src/position.js"

function referenceStringIndex(source: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0

  const bytes = new TextEncoder().encode(source)

  return new TextDecoder().decode(bytes.subarray(0, Math.min(byteOffset, bytes.length))).length
}

function referenceByteOffset(source: string, stringIndex: number): number {
  return new TextEncoder().encode(source.slice(0, Math.max(0, stringIndex))).length
}

const sources = {
  ascii: "<% if user %>\n  <%= user.name %>\n<% end %>\n",
  multibyte: "<p>Grüße</p>\n<%= \"Grüße\" %>\n",
  astral: "<span>🎉</span>\n<%= \"🎉 party\" %>\n",
  crlf: "<div>\r\n  <%= title %>\r\n</div>\r\n",
  lone: "a\ud800b\udc00c",
  empty: "",
}

describe("SourceOffsets", () => {
  for (const [name, source] of Object.entries(sources)) {
    describe(`${name} source`, () => {
      const offsets = new SourceOffsets(source)
      const byteLength = new TextEncoder().encode(source).length

      test("reports the UTF-8 byte length", () => {
        expect(offsets.byteLength).toBe(byteLength)
      })

      test("encodes the source bytes", () => {
        expect(offsets.bytes).toEqual(new TextEncoder().encode(source))
        expect(offsets.bytes).toBe(offsets.bytes)
      })

      test("matches TextDecoder for every byte offset", () => {
        for (let byteOffset = -1; byteOffset <= byteLength + 1; byteOffset++) {
          expect(offsets.stringIndexFromByteOffset(byteOffset), `byte offset ${byteOffset}`).toBe(referenceStringIndex(source, byteOffset))
        }
      })

      test("matches TextEncoder for every string index", () => {
        for (let stringIndex = -1; stringIndex <= source.length + 1; stringIndex++) {
          expect(offsets.byteOffsetFromStringIndex(stringIndex), `string index ${stringIndex}`).toBe(referenceByteOffset(source, Math.min(stringIndex, source.length)))
        }
      })

      test("matches offsetFromPosition for every position", () => {
        const lineCount = source.split("\n").length

        for (let line = 0; line <= lineCount + 1; line++) {
          for (let column = -1; column <= source.length + 1; column++) {
            const position = new Position(line, column)

            expect(offsets.stringIndexFromPosition(position), `position ${line}:${column}`).toBe(offsetFromPosition(source, position))
          }
        }
      })

      test("matches positionFromOffset for every string index", () => {
        for (let stringIndex = -1; stringIndex <= source.length + 1; stringIndex++) {
          expect(offsets.positionFromStringIndex(stringIndex).toHash(), `string index ${stringIndex}`).toEqual(positionFromOffset(source, stringIndex).toHash())
        }
      })
    })
  }

  test("converts byte offsets past multibyte characters", () => {
    const source = "<p>Grüße</p>"
    const offsets = new SourceOffsets(source)

    expect(offsets.byteLength).toBe(14)
    expect(offsets.stringIndexFromByteOffset(9)).toBe(7)
    expect(offsets.byteOffsetFromStringIndex(7)).toBe(9)
    expect(offsets.substringFromByteOffset(3, 7)).toBe("Grüße")
  })

  test("converts byte offsets past astral characters", () => {
    const source = "<span>🎉</span>"
    const offsets = new SourceOffsets(source)

    expect(offsets.byteLength).toBe(17)
    expect(offsets.stringIndexFromByteOffset(10)).toBe(8)
    expect(offsets.byteOffsetFromStringIndex(8)).toBe(10)
    expect(offsets.substringFromByteOffset(6, 4)).toBe("🎉")
  })

  test("builds Locations across lines", () => {
    const source = "<p>Grüße</p>\n<%= \"🎉\" %>\n"
    const offsets = new SourceOffsets(source)
    const start = new TextEncoder().encode("<p>Grüße</p>\n<%= ").length

    expect(offsets.locationFromByteOffset(start, 6)).toEqual(Location.from(2, 4, 2, 8))
    expect(offsets.substringFromByteOffset(start, 6)).toBe("\"🎉\"")
  })

  test("counts carriage returns as columns in CRLF sources", () => {
    const source = "<div>\r\n  <%= title %>\r\n</div>\r\n"
    const offsets = new SourceOffsets(source)

    expect(offsets.locationFromByteOffset(13, 5)).toEqual(Location.from(2, 6, 2, 11))
    expect(offsets.positionFromByteOffset(source.indexOf("\r\n</div>")).toHash()).toEqual({ line: 2, column: 14 })
    expect(offsets.positionFromByteOffset(source.indexOf("</div>")).toHash()).toEqual({ line: 3, column: 0 })
  })

  test("for reuses the instance for the same source", () => {
    const source = "<p>Grüße</p>"
    const first = SourceOffsets.for(source)

    expect(SourceOffsets.for(source)).toBe(first)
    expect(SourceOffsets.for("<p>🎉</p>")).not.toBe(first)
  })
})
