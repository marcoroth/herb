import type {
  SerializedLexResult,
  SerializedParseResult,
} from "@herb-tools/core"

import libherb from "./libherb.js"

class WASMBinary {
  static lex(source: string) {
    return libherb.cwrap("herb_lex", "string", ["string"])(source)
  }

  static lexToJson(source: string) {
    return libherb.cwrap("herb_lex_json", "string", ["string"])(source)
  }

  static parse(source: string) {
    return libherb.cwrap("herb_parse", "string", ["string"])(source)
  }

  static extractRuby(source: string) {
    return libherb.cwrap("herb_extract_ruby", "string", ["string"])(source)
  }

  static extractHtml(source: string) {
    return libherb.cwrap("herb_extract_html", "string", ["string"])(source)
  }

  static version() {
    return libherb.cwrap("herb_version", "string", [])()
  }
}

export default WASMBinary
