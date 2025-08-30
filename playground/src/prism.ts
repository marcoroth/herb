import Prism from "prismjs"

Prism.languages.tree = {
  // Node definitions (@ DocumentNode, @ HTMLElementNode, etc.)
  node: {
    pattern: /@ [A-Za-z]+Node\b/,
    greedy: true,
  },

  namedspaced_class: {
    pattern: /Herb::(\w)+\b/,
    greedy: true,
  },

  // Location markers
  location: {
    pattern: /\(location: \(\d+:\d+\)-\(\d+:\d+\)\)/,
    greedy: true,
  },

  // Tree structure symbols
  "tree-symbol": {
    pattern: /[│├└─]/,
    greedy: true,
  },

  // Empty set
  "tree-null": {
    pattern: /[∅]/,
    greedy: true,
  },

  // Property names
  property: {
    pattern:
      /\b(?:errors|children|tag_opening|content|tag_closing|open_tag|tag_name|attributes|equals|value|open_quote|close_quote|quoted|is_void|body|close_tag|message|opening_tag|closing_tag|comment_start|comment_end|name|expected_type|found|description|expected|subsequent|rescue_clause|else_clause|ensure_clause|end_node|parsed|valid|error_message|diagnostic_id|level|statements|conditions|source)\b:/,
    lookbehind: true,
    greedy: true,
  },

  // Error class names
  "error-class": {
    pattern: /@ [A-Za-z]+Error\b/,
    greedy: true,
  },

  // Numbers (counts, indices)
  number: {
    pattern: /\b\d+\b/,
    greedy: true,
  },

  // Strings
  string: [
    {
      // Handle standard quoted strings with possible escaped quotes
      pattern: /"(?:[^"\\]|\\.|"(?="))*"/,
      greedy: true,
    },
    {
      // Handle consecutive quotes (like triple quotes)
      pattern: /"{2,3}/,
      greedy: true,
    },
  ],

  // Counts (items)
  count: {
    pattern: /\(\d+ (?:items?|errors?)\)/,
    greedy: true,
  },

  // Boolean values
  boolean: {
    pattern: /\b(?:true|false)\b/,
    greedy: true,
  },
}
