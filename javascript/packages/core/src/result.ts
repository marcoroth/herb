export class Result {
  readonly source: string
  readonly warnings: any[] // TODO: update
  readonly errors: any[] // TODO: update

  constructor(source: string, warnings: any[] = [], errors: any[] = []) {
    this.source = source
    this.warnings = warnings
    this.errors = errors
  }

  success(): boolean {
    return false
  }

  failed(): boolean {
    return true
  }
}
