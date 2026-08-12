/**
 * The UTF-8 byte order mark, `U+FEFF`, encoded as the bytes `EF BB BF`.
 */
export const BYTE_ORDER_MARK = "\uFEFF"

export function ensureString(object: any): string {
  if (typeof object === "string") {
    return object
  }

  throw new TypeError("Argument must be a string")
}
