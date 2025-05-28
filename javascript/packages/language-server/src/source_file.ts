export class SourceFile {
  path: string
  errors: Array<any>

  constructor(path: string) {
    this.path = path
    this.errors = []
  }
}
