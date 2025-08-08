export const GLOBAL_HTML_ATTRIBUTES = new Set([
  "accesskey", "autocapitalize", "autofocus", "contenteditable", "dir",
  "draggable", "enterkeyhint", "hidden", "inert", "inputmode", "is",
  "itemid", "itemprop", "itemref", "itemscope", "itemtype", "lang",
  "nonce", "popover", "spellcheck", "style", "tabindex", "title", "translate",

  "class", "id", "slot",

  "role", "aria-activedescendant", "aria-atomic", "aria-autocomplete",
  "aria-busy", "aria-checked", "aria-colcount", "aria-colindex",
  "aria-colspan", "aria-controls", "aria-current", "aria-describedby",
  "aria-details", "aria-disabled", "aria-dropeffect", "aria-errormessage",
  "aria-expanded", "aria-flowto", "aria-grabbed", "aria-haspopup",
  "aria-hidden", "aria-invalid", "aria-keyshortcuts", "aria-label",
  "aria-labelledby", "aria-level", "aria-live", "aria-modal", "aria-multiline",
  "aria-multiselectable", "aria-orientation", "aria-owns", "aria-placeholder",
  "aria-posinset", "aria-pressed", "aria-readonly", "aria-relevant",
  "aria-required", "aria-roledescription", "aria-rowcount", "aria-rowindex",
  "aria-rowspan", "aria-selected", "aria-setsize", "aria-sort", "aria-valuemax",
  "aria-valuemin", "aria-valuenow", "aria-valuetext",
])

export const HTML_ELEMENT_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set([
    "download", "href", "hreflang", "media", "ping", "referrerpolicy",
    "rel", "target", "type"
  ]),

  area: new Set([
    "alt", "coords", "download", "href", "hreflang", "media", "ping",
    "referrerpolicy", "rel", "shape", "target"
  ]),

  audio: new Set([
    "autoplay", "controls", "crossorigin", "loop", "muted", "preload", "src"
  ]),

  base: new Set(["href", "target"]),

  button: new Set([
    "disabled", "form", "formaction", "formenctype", "formmethod",
    "formnovalidate", "formtarget", "name", "popovertarget",
    "popovertargetaction", "type", "value"
  ]),

  canvas: new Set(["height", "width"]),

  data: new Set(["value"]),

  details: new Set(["open", "name"]),

  dialog: new Set(["open"]),

  embed: new Set(["height", "src", "type", "width"]),

  fieldset: new Set(["disabled", "form", "name"]),

  form: new Set([
    "accept-charset", "action", "autocomplete", "enctype", "method",
    "name", "novalidate", "rel", "target"
  ]),

  iframe: new Set([
    "allow", "allowfullscreen", "csp", "height", "loading", "name",
    "referrerpolicy", "sandbox", "src", "srcdoc", "width"
  ]),

  img: new Set([
    "alt", "crossorigin", "decoding", "fetchpriority", "height", "ismap",
    "loading", "referrerpolicy", "sizes", "src", "srcset", "usemap", "width"
  ]),

  input: new Set([
    "accept", "alt", "autocomplete", "capture", "checked", "dirname",
    "disabled", "form", "formaction", "formenctype", "formmethod",
    "formnovalidate", "formtarget", "height", "list", "max", "maxlength",
    "min", "minlength", "multiple", "name", "pattern", "placeholder",
    "popovertarget", "popovertargetaction", "readonly", "required", "size",
    "src", "step", "type", "value", "width"
  ]),

  label: new Set(["for", "form"]),

  link: new Set([
    "as", "blocking", "crossorigin", "disabled", "fetchpriority", "href",
    "hreflang", "imagesizes", "imagesrcset", "integrity", "media",
    "referrerpolicy", "rel", "sizes", "type"
  ]),

  map: new Set(["name"]),

  meta: new Set(["charset", "content", "http-equiv", "media", "name", "property", "itemprop"]),

  meter: new Set(["high", "low", "max", "min", "optimum", "value", "form"]),

  object: new Set([
    "data", "form", "height", "name", "type", "usemap", "width"
  ]),

  ol: new Set(["reversed", "start", "type"]),

  optgroup: new Set(["disabled", "label"]),

  option: new Set(["disabled", "label", "selected", "value"]),

  output: new Set(["for", "form", "name"]),

  progress: new Set(["max", "value"]),

  blockquote: new Set(["cite"]),
  q: new Set(["cite"]),

  script: new Set([
    "async", "blocking", "crossorigin", "defer", "fetchpriority",
    "integrity", "nomodule", "referrerpolicy", "src", "type"
  ]),

  select: new Set([
    "autocomplete", "disabled", "form", "multiple", "name", "required", "size"
  ]),

  source: new Set([
    "height", "media", "sizes", "src", "srcset", "type", "width"
  ]),

  style: new Set(["blocking", "media", "type", "nonce", "title"]),

  table: new Set(["align", "bgcolor", "border", "cellpadding", "cellspacing", "frame", "rules", "summary", "width"]),

  td: new Set(["colspan", "headers", "rowspan", "align", "valign", "bgcolor", "height", "width"]),
  th: new Set(["abbr", "colspan", "headers", "rowspan", "scope", "align", "valign", "bgcolor", "height", "width"]),

  col: new Set(["span", "align", "valign", "width"]),
  colgroup: new Set(["span", "align", "valign", "width"]),

  tr: new Set(["align", "bgcolor", "valign"]),

  textarea: new Set([
    "autocomplete", "cols", "dirname", "disabled", "form", "maxlength",
    "minlength", "name", "placeholder", "readonly", "required", "rows",
    "wrap"
  ]),

  time: new Set(["datetime"]),

  track: new Set(["default", "kind", "label", "src", "srclang"]),

  video: new Set([
    "autoplay", "controls", "controlslist", "crossorigin", "disablepictureinpicture",
    "disableremoteplayback", "height", "loop", "muted", "playsinline",
    "poster", "preload", "src", "width"
  ]),

  del: new Set(["cite", "datetime"]),
  ins: new Set(["cite", "datetime"]),
  li: new Set(["value", "type"]),

  html: new Set(["lang", "xmlns", "manifest"]),

  body: new Set(["onload", "onunload", "onbeforeunload"]),

  slot: new Set(["name"]),

  // Elements with no specific attributes (only global attributes apply)
  abbr: new Set([]),
  address: new Set([]),
  article: new Set([]),
  aside: new Set([]),
  b: new Set([]),
  bdi: new Set([]),
  bdo: new Set([]),
  br: new Set([]),
  caption: new Set([]),
  cite: new Set([]),
  code: new Set([]),
  datalist: new Set([]),
  dd: new Set([]),
  dfn: new Set([]),
  div: new Set([]),
  dl: new Set([]),
  dt: new Set([]),
  em: new Set([]),
  figcaption: new Set([]),
  figure: new Set([]),
  footer: new Set([]),
  h1: new Set([]),
  h2: new Set([]),
  h3: new Set([]),
  h4: new Set([]),
  h5: new Set([]),
  h6: new Set([]),
  head: new Set([]),
  header: new Set([]),
  hgroup: new Set([]),
  hr: new Set([]),
  i: new Set([]),
  kbd: new Set([]),
  legend: new Set([]),
  main: new Set([]),
  mark: new Set([]),
  menu: new Set([]),
  nav: new Set([]),
  noscript: new Set([]),
  p: new Set([]),
  picture: new Set([]),
  pre: new Set([]),
  rp: new Set([]),
  rt: new Set([]),
  ruby: new Set([]),
  s: new Set([]),
  samp: new Set([]),
  search: new Set([]),
  section: new Set([]),
  small: new Set([]),
  span: new Set([]),
  strong: new Set([]),
  sub: new Set([]),
  summary: new Set([]),
  sup: new Set([]),
  tbody: new Set([]),
  template: new Set([]),
  tfoot: new Set([]),
  thead: new Set([]),
  title: new Set([]),
  u: new Set([]),
  ul: new Set([]),
  var: new Set([]),
  wbr: new Set([]),

  svg: new Set([
    "width", "height", "viewbox", "xmlns", "xmlns:xlink", "version", "baseprofile",
    "preserveaspectratio", "x", "y", "fill", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "opacity", "transform"
  ]),

  g: new Set([
    "transform", "opacity", "fill", "stroke", "stroke-width", "clip-path", "mask"
  ]),

  path: new Set([
    "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "opacity", "transform"
  ]),

  circle: new Set([
    "cx", "cy", "r", "fill", "stroke", "stroke-width", "opacity", "transform"
  ]),

  rect: new Set([
    "x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width",
    "opacity", "transform"
  ]),

  ellipse: new Set([
    "cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width", "opacity", "transform"
  ]),

  line: new Set([
    "x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-linecap",
    "opacity", "transform"
  ]),

  text: new Set([
    "x", "y", "dx", "dy", "font-family", "font-size", "font-weight", "text-anchor",
    "fill", "stroke", "opacity", "transform"
  ]),

  use: new Set([
    "href", "xlink:href", "x", "y", "width", "height", "transform"
  ])
}

export const VALID_HTML_ELEMENTS = new Set([
  // Document metadata
  "html", "head", "title", "base", "link", "meta", "style",

  // Sections
  "body", "article", "section", "nav", "aside", "h1", "h2", "h3", "h4", "h5", "h6",
  "hgroup", "header", "footer", "address",

  // Grouping content
  "p", "hr", "pre", "blockquote", "ol", "ul", "menu", "li", "dl", "dt", "dd",
  "figure", "figcaption", "main", "search", "div",

  // Text-level semantics
  "a", "em", "strong", "small", "s", "cite", "q", "dfn", "abbr", "ruby", "rt", "rp",
  "data", "time", "code", "var", "samp", "kbd", "sub", "sup", "i", "b", "u", "mark",
  "bdi", "bdo", "span", "br", "wbr",

  // Edits
  "ins", "del",

  // Embedded content
  "picture", "source", "img", "iframe", "embed", "object", "video", "audio", "track",
  "map", "area",

  // SVG elements (inline SVG)
  "svg", "g", "path", "circle", "rect", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath", "defs", "use", "symbol", "marker", "clipPath", "mask",
  "pattern", "image", "foreignObject", "switch", "animate", "animateMotion",
  "animateTransform", "set", "linearGradient", "radialGradient", "stop", "filter",
  "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix",
  "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood",
  "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge",
  "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting",
  "feSpotLight", "feTile", "feTurbulence", "metadata", "title", "desc",

  // Tabular data
  "table", "caption", "colgroup", "col", "tbody", "thead", "tfoot", "tr", "td", "th",

  // Forms
  "form", "label", "input", "button", "select", "datalist", "optgroup", "option",
  "textarea", "output", "progress", "meter", "fieldset", "legend",

  // Interactive elements
  "details", "summary", "dialog",

  // Scripting
  "script", "noscript", "template", "slot", "canvas",

  // Deprecated but still valid
  "acronym", "applet", "basefont", "bgsound", "big", "blink", "center", "dir", "font",
  "frame", "frameset", "isindex", "keygen", "listing", "marquee", "menuitem", "multicol",
  "nextid", "nobr", "noembed", "noframes", "param", "plaintext", "rb", "rtc", "spacer",
  "strike", "tt", "xmp"
])

export function getValidAttributesForElement(tagName: string): Set<string> {
  const elementSpecific = HTML_ELEMENT_ATTRIBUTES[tagName.toLowerCase()] || new Set()

  return new Set([...GLOBAL_HTML_ATTRIBUTES, ...elementSpecific])
}
