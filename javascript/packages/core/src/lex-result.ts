import { Result } from "./result.js"
import { TokenList, SerializedTokenList } from "./token-list.js"

export type SerializedLexResult = {
  tokens: SerializedTokenList
  source: string
  warnings: any[]
  errors: any[]
}

export class LexResult extends Result {
  readonly value: TokenList

  static from(result: SerializedLexResult) {
    return new LexResult(
      TokenList.from(result.tokens || []),
      result.source,
      result.warnings,
      result.errors,
    )
  }

  constructor(
    value: TokenList,
    source: string,
    warnings: any[] = [],
    errors: any[] = [],
  ) {
    super(source, warnings, errors)
    this.value = value
  }

  override success(): boolean {
    return this.errors.length === 0
  }

  override failed(): boolean {
    return this.errors.length > 0
  }

  toJSON() {
    return {
      value: this.value,
      source: this.source,
      warnings: this.warnings,
      errors: this.errors,
    }
  }
}
