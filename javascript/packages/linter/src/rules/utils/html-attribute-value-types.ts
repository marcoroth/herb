export type AttributeValueType =
  | "boolean"         // Boolean attributes (present = true, absent = false)
  | "string"          // Any string value
  | "number"          // Numeric value
  | "url"             // Valid URL
  | "email"           // Valid email address
  | "color"           // Valid color value
  | "datetime"        // Valid datetime string
  | "language"        // Valid language code
  | "mime-type"       // Valid MIME type
  | "enum"            // One of a specific set of values
  | "space-separated" // Space-separated list of values
  | "comma-separated" // Comma-separated list of values
  | "pattern"         // Must match a regex pattern
  | "id-reference"    // Reference to an element ID
  | "class-list"      // Space-separated class names

export interface AttributeValueRule {
  type: AttributeValueType
  enum?: string[]
  pattern?: RegExp
  min?: number
  max?: number
  allowEmpty?: boolean
  caseSensitive?: boolean
}

export const GLOBAL_ATTRIBUTE_TYPES: Record<string, AttributeValueRule> = {
  "id": { type: "string", pattern: /^[a-zA-Z][\w-]*$/ },
  "class": { type: "class-list" },
  "style": { type: "string" },
  "title": { type: "string" },
  "lang": { type: "language" },
  "dir": { type: "enum", enum: ["ltr", "rtl", "auto"], caseSensitive: false },
  "hidden": { type: "boolean" },
  "tabindex": { type: "number", min: -1 },
  "accesskey": { type: "string" },
  "contenteditable": { type: "enum", enum: ["true", "false", "", "plaintext-only"], caseSensitive: false },
  "draggable": { type: "enum", enum: ["true", "false", "auto"], caseSensitive: false },
  "spellcheck": { type: "enum", enum: ["true", "false", "default"], caseSensitive: false },
  "translate": { type: "enum", enum: ["yes", "no"], caseSensitive: false },
  "role": { type: "string" }, // ARIA role - validated by separate rule
}

export const ELEMENT_ATTRIBUTE_TYPES: Record<string, Record<string, AttributeValueRule>> = {
  a: {
    "href": { type: "url", allowEmpty: true },
    "target": { type: "enum", enum: ["_blank", "_self", "_parent", "_top"], caseSensitive: false },
    "rel": { type: "space-separated", enum: ["alternate", "author", "bookmark", "canonical", "dns-prefetch", "external", "help", "icon", "license", "manifest", "modulepreload", "next", "nofollow", "noopener", "noreferrer", "opener", "pingback", "preconnect", "prefetch", "preload", "prev", "search", "stylesheet", "tag"] },
    "download": { type: "string", allowEmpty: true },
    "hreflang": { type: "language" },
    "type": { type: "mime-type" },
    "referrerpolicy": { type: "enum", enum: ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"], caseSensitive: false },
  },

  img: {
    "src": { type: "url", allowEmpty: false },
    "alt": { type: "string", allowEmpty: true },
    "width": { type: "number", min: 0 },
    "height": { type: "number", min: 0 },
    "loading": { type: "enum", enum: ["eager", "lazy"], caseSensitive: false },
    "decoding": { type: "enum", enum: ["sync", "async", "auto"], caseSensitive: false },
    "crossorigin": { type: "enum", enum: ["anonymous", "use-credentials", ""], caseSensitive: false },
    "referrerpolicy": { type: "enum", enum: ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"], caseSensitive: false },
    "srcset": { type: "string" }, // Complex format
    "sizes": { type: "string" }, // Complex format
  },

  input: {
    "type": { type: "enum", enum: ["button", "checkbox", "color", "date", "datetime-local", "email", "file", "hidden", "image", "month", "number", "password", "radio", "range", "reset", "search", "submit", "tel", "text", "time", "url", "week"], caseSensitive: false },
    "name": { type: "string", allowEmpty: false },
    "value": { type: "string", allowEmpty: true },
    "placeholder": { type: "string" },
    "required": { type: "boolean" },
    "disabled": { type: "boolean" },
    "readonly": { type: "boolean" },
    "checked": { type: "boolean" },
    "multiple": { type: "boolean" },
    "autofocus": { type: "boolean" },
    "autocomplete": { type: "enum", enum: ["on", "off", "name", "email", "username", "current-password", "new-password", "one-time-code", "street-address", "address-level1", "address-level2", "postal-code", "country", "tel", "url"], caseSensitive: false },
    "min": { type: "string" }, // Can be number or date depending on input type
    "max": { type: "string" }, // Can be number or date depending on input type
    "step": { type: "number", min: 0 },
    "maxlength": { type: "number", min: 0 },
    "minlength": { type: "number", min: 0 },
    "pattern": { type: "string" }, // Regex pattern
    "accept": { type: "comma-separated" }, // MIME types
    "size": { type: "number", min: 1 },
  },

  button: {
    "type": { type: "enum", enum: ["button", "submit", "reset"], caseSensitive: false },
    "name": { type: "string", allowEmpty: false },
    "value": { type: "string", allowEmpty: true },
    "disabled": { type: "boolean" },
    "autofocus": { type: "boolean" },
  },

  form: {
    "action": { type: "url", allowEmpty: true },
    "method": { type: "enum", enum: ["get", "post", "dialog"], caseSensitive: false },
    "enctype": { type: "enum", enum: ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"], caseSensitive: false },
    "target": { type: "enum", enum: ["_blank", "_self", "_parent", "_top"], caseSensitive: false },
    "novalidate": { type: "boolean" },
    "autocomplete": { type: "enum", enum: ["on", "off"], caseSensitive: false },
  },

  label: {
    "for": { type: "id-reference" },
  },

  select: {
    "name": { type: "string", allowEmpty: false },
    "multiple": { type: "boolean" },
    "required": { type: "boolean" },
    "disabled": { type: "boolean" },
    "autofocus": { type: "boolean" },
    "size": { type: "number", min: 1 },
  },

  option: {
    "value": { type: "string", allowEmpty: true },
    "selected": { type: "boolean" },
    "disabled": { type: "boolean" },
    "label": { type: "string" },
  },

  textarea: {
    "name": { type: "string", allowEmpty: false },
    "placeholder": { type: "string" },
    "required": { type: "boolean" },
    "disabled": { type: "boolean" },
    "readonly": { type: "boolean" },
    "autofocus": { type: "boolean" },
    "rows": { type: "number", min: 1 },
    "cols": { type: "number", min: 1 },
    "maxlength": { type: "number", min: 0 },
    "minlength": { type: "number", min: 0 },
    "wrap": { type: "enum", enum: ["hard", "soft"], caseSensitive: false },
  },

  video: {
    "src": { type: "url", allowEmpty: false },
    "poster": { type: "url", allowEmpty: false },
    "width": { type: "number", min: 0 },
    "height": { type: "number", min: 0 },
    "controls": { type: "boolean" },
    "autoplay": { type: "boolean" },
    "loop": { type: "boolean" },
    "muted": { type: "boolean" },
    "preload": { type: "enum", enum: ["none", "metadata", "auto"], caseSensitive: false },
    "crossorigin": { type: "enum", enum: ["anonymous", "use-credentials", ""], caseSensitive: false },
  },

  audio: {
    "src": { type: "url", allowEmpty: false },
    "controls": { type: "boolean" },
    "autoplay": { type: "boolean" },
    "loop": { type: "boolean" },
    "muted": { type: "boolean" },
    "preload": { type: "enum", enum: ["none", "metadata", "auto"], caseSensitive: false },
    "crossorigin": { type: "enum", enum: ["anonymous", "use-credentials", ""], caseSensitive: false },
  },

  link: {
    "href": { type: "url", allowEmpty: false },
    "rel": { type: "space-separated", enum: ["alternate", "apple-touch-icon", "canonical", "dns-prefetch", "icon", "manifest", "modulepreload", "next", "pingback", "preconnect", "prefetch", "preload", "prev", "search", "stylesheet"] },
    "type": { type: "mime-type" },
    "media": { type: "string" }, // Media query
    "sizes": { type: "string" },
    "crossorigin": { type: "enum", enum: ["anonymous", "use-credentials", ""], caseSensitive: false },
    "integrity": { type: "string" }, // Subresource integrity hash
    "referrerpolicy": { type: "enum", enum: ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"], caseSensitive: false },
  },

  meta: {
    "name": { type: "string", allowEmpty: false },
    "content": { type: "string", allowEmpty: true },
    "charset": { type: "string" }, // Character encoding
    "http-equiv": { type: "enum", enum: ["content-security-policy", "content-type", "default-style", "refresh", "x-ua-compatible"], caseSensitive: false },
    "property": { type: "string" }, // Open Graph, Twitter Cards, etc.
  },

  script: {
    "src": { type: "url", allowEmpty: false },
    "type": { type: "enum", enum: ["text/javascript", "application/javascript", "module", "text/ecmascript", "application/ecmascript"], caseSensitive: false },
    "async": { type: "boolean" },
    "defer": { type: "boolean" },
    "crossorigin": { type: "enum", enum: ["anonymous", "use-credentials", ""], caseSensitive: false },
    "integrity": { type: "string" }, // Subresource integrity hash
    "nomodule": { type: "boolean" },
    "referrerpolicy": { type: "enum", enum: ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"], caseSensitive: false },
  },

  iframe: {
    "src": { type: "url", allowEmpty: false },
    "srcdoc": { type: "string" },
    "name": { type: "string" },
    "width": { type: "number", min: 0 },
    "height": { type: "number", min: 0 },
    "allowfullscreen": { type: "boolean" },
    "referrerpolicy": { type: "enum", enum: ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"], caseSensitive: false },
    "sandbox": { type: "space-separated", enum: ["allow-forms", "allow-modals", "allow-orientation-lock", "allow-pointer-lock", "allow-popups", "allow-popups-to-escape-sandbox", "allow-presentation", "allow-same-origin", "allow-scripts", "allow-top-navigation", "allow-top-navigation-by-user-activation"] },
    "loading": { type: "enum", enum: ["eager", "lazy"], caseSensitive: false },
  },

  table: {
    "border": { type: "number", min: 0 },
  },

  th: {
    "scope": { type: "enum", enum: ["row", "col", "rowgroup", "colgroup"], caseSensitive: false },
    "colspan": { type: "number", min: 1 },
    "rowspan": { type: "number", min: 1 },
    "headers": { type: "space-separated" }, // IDs of th elements
  },

  td: {
    "colspan": { type: "number", min: 1 },
    "rowspan": { type: "number", min: 1 },
    "headers": { type: "space-separated" }, // IDs of th elements
  },

  ol: {
    "reversed": { type: "boolean" },
    "start": { type: "number" },
    "type": { type: "enum", enum: ["1", "a", "A", "i", "I"], caseSensitive: true },
  },

  li: {
    "value": { type: "number" },
  },

  time: {
    "datetime": { type: "datetime" },
  },

  progress: {
    "value": { type: "number", min: 0 },
    "max": { type: "number", min: 0 },
  },

  meter: {
    "value": { type: "number" },
    "min": { type: "number" },
    "max": { type: "number" },
    "low": { type: "number" },
    "high": { type: "number" },
    "optimum": { type: "number" },
  },
}

export function getAttributeValueRule(elementName: string, attributeName: string): AttributeValueRule | null {
  const globalRule = GLOBAL_ATTRIBUTE_TYPES[attributeName.toLowerCase()]

  if (globalRule) return globalRule

  const elementRules = ELEMENT_ATTRIBUTE_TYPES[elementName.toLowerCase()]

  if (elementRules) {
    const rule = elementRules[attributeName.toLowerCase()]

    if (rule) {
      return rule
    }
  }

  return null
}
