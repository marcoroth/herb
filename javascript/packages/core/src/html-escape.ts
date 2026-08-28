/**
 * Escaping text for HTML output.
 *
 * The table covers the five characters the HTML spec calls out, and it is the same set and the
 * same entities `Herb::Engine.h` writes on the server, so a fragment escaped here matches one
 * escaped there byte for byte.
 */

export const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const HTML_ESCAPE_PATTERN = /[&<>"']/g

/**
 * Escapes a string for use as HTML text or as the value of a double-quoted or single-quoted
 * attribute.
 */
export function escapeHTML(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPES[character])
}
