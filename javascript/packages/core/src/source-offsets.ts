import { Location } from "./location.js"
import { Position } from "./position.js"

/**
 * Converts between UTF-8 byte offsets (as reported by Prism node locations),
 * UTF-16 string indexes and line/column Positions for a single source string.
 *
 * The lookup tables are computed once in the constructor, so every conversion
 * after that is constant time (or a binary search for Positions). Create one
 * instance per source and reuse it, instead of calling the standalone
 * `stringIndexFromByteOffset`/`locationFromByteOffset` helpers in a loop.
 *
 * Byte offsets follow `TextEncoder`/`TextDecoder` semantics, so a byte offset
 * inside a multi-byte character maps to the index right after the character's
 * first UTF-16 code unit, and a lone surrogate counts as three bytes.
 */
export class SourceOffsets {
  private static cached: SourceOffsets | null = null

  /**
   * Returns a `SourceOffsets` for `source`, reusing the instance from the
   * previous call when it was made with the same source.
   *
   * @param source - The source string to convert offsets for
   * @returns A `SourceOffsets` for `source`
   */
  static for(source: string): SourceOffsets {
    if (SourceOffsets.cached?.source !== source) {
      SourceOffsets.cached = new SourceOffsets(source)
    }

    return SourceOffsets.cached
  }

  readonly source: string
  readonly byteLength: number

  private encoded: Uint8Array | null = null
  private readonly lineStarts: number[]
  private readonly byteToIndex: Uint32Array | null
  private readonly indexToByte: Uint32Array | null

  constructor(source: string) {
    this.source = source
    this.lineStarts = [0]

    const length = source.length
    let byteLength = 0

    for (let index = 0; index < length; index++) {
      const code = source.charCodeAt(index)

      if (code === 10) this.lineStarts.push(index + 1)

      byteLength += SourceOffsets.byteWidth(source, index, code)

      if (SourceOffsets.isSurrogatePair(source, index, code)) index++
    }

    this.byteLength = byteLength

    if (byteLength === length) {
      this.byteToIndex = null
      this.indexToByte = null

      return
    }

    this.byteToIndex = new Uint32Array(byteLength + 1)
    this.indexToByte = new Uint32Array(length + 1)

    let byte = 0

    for (let index = 0; index < length; index++) {
      const code = source.charCodeAt(index)
      const width = SourceOffsets.byteWidth(source, index, code)

      this.byteToIndex[byte] = index
      this.byteToIndex.fill(index + 1, byte + 1, byte + width)
      this.indexToByte[index] = byte

      if (SourceOffsets.isSurrogatePair(source, index, code)) {
        this.indexToByte[index + 1] = byte + 3
        index++
      }

      byte += width
    }

    this.byteToIndex[byteLength] = length
    this.indexToByte[length] = byteLength
  }

  /**
   * The UTF-8 encoded bytes of the source, encoded on first access.
   */
  get bytes(): Uint8Array {
    if (this.encoded === null) {
      this.encoded = new TextEncoder().encode(this.source)
    }

    return this.encoded
  }

  /**
   * Converts a UTF-8 byte offset into the corresponding UTF-16 string index.
   *
   * @param byteOffset - A UTF-8 byte offset, e.g. from `node.location.startOffset`
   * @returns The UTF-16 string index, clamped to the bounds of the source
   */
  stringIndexFromByteOffset(byteOffset: number): number {
    if (byteOffset <= 0) return 0
    if (byteOffset >= this.byteLength) return this.source.length
    if (this.byteToIndex === null) return byteOffset

    return this.byteToIndex[byteOffset]
  }

  /**
   * Converts a UTF-16 string index into the corresponding UTF-8 byte offset.
   *
   * @param stringIndex - A UTF-16 string index into the source
   * @returns The UTF-8 byte offset, clamped to the bounds of the source
   */
  byteOffsetFromStringIndex(stringIndex: number): number {
    if (stringIndex <= 0) return 0
    if (stringIndex >= this.source.length) return this.byteLength
    if (this.indexToByte === null) return stringIndex

    return this.indexToByte[stringIndex]
  }

  /**
   * Converts a UTF-16 string index into a Position.
   * Lines are 1-based, columns are 0-based UTF-16 code units.
   *
   * @param stringIndex - A UTF-16 string index into the source
   * @returns The Position at `stringIndex`, clamped to the bounds of the source
   */
  positionFromStringIndex(stringIndex: number): Position {
    const index = Math.max(0, Math.min(stringIndex, this.source.length))
    const lineStarts = this.lineStarts

    let low = 0
    let high = lineStarts.length - 1

    while (low < high) {
      const middle = (low + high + 1) >> 1

      if (lineStarts[middle] <= index) {
        low = middle
      } else {
        high = middle - 1
      }
    }

    return new Position(low + 1, index - lineStarts[low])
  }

  /**
   * Converts a Position into a UTF-16 string index.
   * Lines are 1-based, columns are 0-based UTF-16 code units.
   *
   * @param position - The Position to resolve
   * @returns A UTF-16 string index, or `null` when the position falls outside of the source
   */
  stringIndexFromPosition(position: Position): number | null {
    if (position.line < 1 || position.column < 0) return null
    if (position.line > this.lineStarts.length) return null

    const lineStart = this.lineStarts[position.line - 1]
    const lineEnd = position.line < this.lineStarts.length ? this.lineStarts[position.line] - 1 : this.source.length

    if (position.column > lineEnd - lineStart) return null

    return lineStart + position.column
  }

  /**
   * Converts a UTF-8 byte offset into a Position.
   *
   * @param byteOffset - A UTF-8 byte offset, e.g. from `node.location.startOffset`
   * @returns The Position at `byteOffset`
   */
  positionFromByteOffset(byteOffset: number): Position {
    return this.positionFromStringIndex(this.stringIndexFromByteOffset(byteOffset))
  }

  /**
   * Creates a Location from a Prism byte offset and byte length.
   *
   * @param startByteOffset - A UTF-8 byte offset, e.g. from `node.location.startOffset`
   * @param byteLength - A UTF-8 byte length, e.g. from `node.location.length`
   * @returns The Location spanning the Prism node
   */
  locationFromByteOffset(startByteOffset: number, byteLength: number): Location {
    const start = this.positionFromByteOffset(startByteOffset)
    const end = this.positionFromByteOffset(startByteOffset + byteLength)

    return Location.from(start.line, start.column, end.line, end.column)
  }

  /**
   * Extracts the substring covered by a Prism byte offset and byte length.
   *
   * @param startByteOffset - A UTF-8 byte offset, e.g. from `node.location.startOffset`
   * @param byteLength - A UTF-8 byte length, e.g. from `node.location.length`
   * @returns The substring of the source spanned by the Prism location
   */
  substringFromByteOffset(startByteOffset: number, byteLength: number): string {
    const start = this.stringIndexFromByteOffset(startByteOffset)
    const end = this.stringIndexFromByteOffset(startByteOffset + byteLength)

    return this.source.substring(start, end)
  }

  private static byteWidth(source: string, index: number, code: number): number {
    if (code < 0x80) return 1
    if (code < 0x800) return 2
    if (SourceOffsets.isSurrogatePair(source, index, code)) return 4

    return 3
  }

  private static isSurrogatePair(source: string, index: number, code: number): boolean {
    if (code < 0xd800 || code > 0xdbff) return false

    const next = source.charCodeAt(index + 1)

    return next >= 0xdc00 && next <= 0xdfff
  }
}
