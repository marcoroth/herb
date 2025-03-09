import { ParseResult, LexResult, ASTNode } from "@herb-tools/core"

// TODO: this is just a stub, replace me with an actual WASM binary
class WASMBinary {
  static lex(source: string) {
    return new LexResult([], source)
  }

  static lexToJson(_source: string) {
    return "{}"
  }

  static parse(source: string) {
    return new ParseResult(new ASTNode(), source, [], [])
  }

  static extractRuby(source: string) {
    return source
  }

  static extractHtml(source: string) {
    return source
  }

  static version() {
    return "libherb@0.0.1 (wasm)"
  }
}

export default WASMBinary
