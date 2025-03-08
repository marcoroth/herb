import type { ASTNode } from './ast.js'
import { Result } from './result.js'

export class ParseResult extends Result {
  readonly value: ASTNode

  constructor(value: ASTNode, source: string, warnings: any[] = [], errors: any[] = []) {
    super(source, warnings, errors)
    this.value = value
  }

  failed(): boolean {
    // TODO: this should probably be recursive as noted in the Ruby version
    return this.errors.length > 0 || this.value.errors.length > 0
  }

  success(): boolean {
    return !this.failed()
  }

  prettyErrors(): string {
    return JSON.stringify([...this.errors, ...this.value.errors], null, 2)
  }
}
