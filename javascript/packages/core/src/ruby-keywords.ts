export const RUBY_KEYWORDS: ReadonlySet<string> = new Set([
  "__ENCODING__",
  "__FILE__",
  "__LINE__",
  "BEGIN",
  "END",
  "alias",
  "and",
  "begin",
  "break",
  "case",
  "class",
  "def",
  "defined?",
  "do",
  "else",
  "elsif",
  "end",
  "ensure",
  "false",
  "for",
  "if",
  "in",
  "module",
  "next",
  "nil",
  "not",
  "or",
  "redo",
  "rescue",
  "retry",
  "return",
  "self",
  "super",
  "then",
  "true",
  "undef",
  "unless",
  "until",
  "when",
  "while",
  "yield",
])

export function isRubyKeyword(name: string): boolean {
  return RUBY_KEYWORDS.has(name)
}

export const RUBY_INTROSPECTION_METHODS: ReadonlySet<string> = new Set([
  "__id__",
  "__send__",
  "class",
  "clone",
  "dup",
  "freeze",
  "frozen",
  "inspect",
  "method",
  "object_id",
  "public_send",
  "send",
  "tap",
  "then",
  "to_s",
  "try",
  "try!",
  "yield_self",
])

export function isRubyIntrospectionMethod(name: string): boolean {
  if (RUBY_INTROSPECTION_METHODS.has(name)) return true

  return name.endsWith("?") || name.endsWith("!")
}
