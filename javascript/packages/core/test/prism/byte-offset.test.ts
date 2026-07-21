import { describe, test, expect } from "vitest"
import { stringIndexFromByteOffset } from "../../src/prism/index.js"

describe("stringIndexFromByteOffset", () => {
  test("returns the same index as the byte offset for ASCII-only source", () => {
    const source = "card_event.event_type"

    expect(stringIndexFromByteOffset(source, 4)).toBe(4)
    expect(stringIndexFromByteOffset(source, source.length)).toBe(source.length)
  })

  test("converts a UTF-8 byte offset past a multi-byte character to the correct UTF-16 index", () => {
    const source = "é card_event"
    // "é" is 1 UTF-16 code unit but 2 UTF-8 bytes, so byte offset 3 (2 bytes for
    // "é" + 1 byte for the space) should map to string index 2.
    const byteOffsetAfterEAndSpace = 3

    expect(stringIndexFromByteOffset(source, byteOffsetAfterEAndSpace)).toBe(2)
    expect(source.substring(2)).toBe("card_event")
  })

  test("converts a UTF-8 byte offset past an emoji (surrogate pair) to the correct UTF-16 index", () => {
    const source = "😀 data"
    // "😀" is 2 UTF-16 code units but 4 UTF-8 bytes, so byte offset 5 (4 bytes
    // for the emoji + 1 byte for the space) should map to string index 3.
    const byteOffsetAfterEmojiAndSpace = 5

    expect(stringIndexFromByteOffset(source, byteOffsetAfterEmojiAndSpace)).toBe(3)
    expect(source.substring(3)).toBe("data")
  })

  test("clamps offsets beyond the byte length of the source", () => {
    const source = "é"

    expect(stringIndexFromByteOffset(source, 100)).toBe(source.length)
  })

  test("returns 0 for a zero or negative offset", () => {
    const source = "é card_event"

    expect(stringIndexFromByteOffset(source, 0)).toBe(0)
    expect(stringIndexFromByteOffset(source, -1)).toBe(0)
  })
})
