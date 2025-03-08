import { Result } from './result.js'
import { TokenList } from './token-list.js'

export class LexResult extends Result {
  readonly value: TokenList

  constructor(value: any[], source: string, warnings: any[] = [], errors: any[] = []) {
    super(source, warnings, errors)
    this.value = new TokenList(value)
  }

  override success(): boolean {
    return this.errors.length === 0
  }

  override failed(): boolean {
    return this.errors.length > 0
  }
}
