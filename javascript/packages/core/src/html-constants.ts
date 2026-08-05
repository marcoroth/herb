// https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes
export const HTML_BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen", "async", "autofocus", "autoplay", "checked", "compact",
  "controls", "declare", "default", "defer", "disabled", "formnovalidate",
  "hidden", "inert", "ismap", "itemscope", "loop", "multiple", "muted",
  "nomodule", "nohref", "noresize", "noshade", "novalidate", "nowrap",
  "open", "playsinline", "readonly", "required", "reversed", "scoped",
  "seamless", "selected", "sortable", "truespeed", "typemustmatch",
])

export function isBooleanAttribute(attributeName: string): boolean {
  return HTML_BOOLEAN_ATTRIBUTES.has(attributeName.toLowerCase())
}
