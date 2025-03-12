import type { Herb } from "@herb-tools/core"

export function analyze(herb: Herb, source: string) {
  return {
    string: herb.parse(source).value.inspect(),
    json: JSON.stringify(herb.parse(source).value, null, 2),
    lex: herb.lex(source).value.inspect(),
    ruby: herb.extractRuby(source),
    html: herb.extractHtml(source),
    version: herb.version,
  }
}
