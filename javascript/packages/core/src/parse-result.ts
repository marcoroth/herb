import { createNode } from "./nodes.js"
import type { DocumentNode } from "./nodes.js"
import { Result } from "./result.js"

export type SerializedParseResult = {
  value: any // TODO: should be SerializedNode or SerializedDocumentNode
  source: string
}

export class ParseResult extends Result {
  readonly value: DocumentNode

  static from(result: SerializedParseResult) {
    return new ParseResult(
      createNode(result.value) as DocumentNode,
      result.source,
    )
  }

  constructor(
    value: DocumentNode,
    source: string,
    warnings: any[] = [],
    errors: any[] = [],
  ) {
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
