// https://html.spec.whatwg.org/multipage/syntax.html#character-references
// JSON source: https://html.spec.whatwg.org/entities.json
import entities from "./html-entities.json"

export interface HTMLCharacterReference {
  characters: string
  codepoints: number[]
}

export const HTML_NAMED_CHARACTER_REFERENCES: Record<string, HTMLCharacterReference> = entities

/**
 * Pattern that matches HTML character references: named (`&amp;`), decimal (`&#60;`), and hexadecimal (`&#x3C;`).
 * Uses capturing groups: group 1 = hex digits, group 2 = decimal digits, group 3 = named reference name.
 *
 * @see https://html.spec.whatwg.org/multipage/syntax.html#character-references
 */
export const CHARACTER_REFERENCE_PATTERN = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z][a-zA-Z0-9]*));/g

export function isNamedCharacterReference(name: string): boolean {
  return name in HTML_NAMED_CHARACTER_REFERENCES
}

export function getNamedCharacterReference(name: string): HTMLCharacterReference | undefined {
  return HTML_NAMED_CHARACTER_REFERENCES[name]
}

/**
 * Checks if a string is a valid HTML character reference.
 * Supports named (`&amp;`), decimal (`&#60;`), and hexadecimal (`&#x3C;`) references.
 *
 * @see https://html.spec.whatwg.org/multipage/syntax.html#character-references
 */
export function isValidCharacterReference(text: string): boolean {
  if (!text.startsWith("&") || !text.endsWith(";")) return false

  if (text.startsWith("&#x")) return /^&#x[0-9a-fA-F]+;$/.test(text)
  if (text.startsWith("&#")) return /^&#[0-9]+;$/.test(text)

  return isNamedCharacterReference(text.slice(1, -1))
}
