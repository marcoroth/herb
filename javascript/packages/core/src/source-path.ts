import { Position } from "./position.js"

const PATTERN = /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):\/\/file(?=\/))?(.*?)(?::(\d+)(?::(\d+))?)?$/
const FILE_SCHEME_SEPARATOR = "://file"

function reportedColumn(column: string | undefined): number | null {
  if (column === undefined) return null

  return Math.max(Number(column) - 1, 0)
}

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)
}

function root(path: string): string {
  const drive = /^([a-zA-Z]:)[\\/]/.exec(path)

  if (drive) {
    return drive[1].toUpperCase()
  }

  return path.startsWith("/") ? "/" : ""
}

function segments(path: string): string[] {
  return path
    .replace(/^[a-zA-Z]:/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
}

function relativeFrom(path: string, project: string): string {
  if (root(path) !== root(project)) return path

  const from = segments(project)
  const to = segments(path)

  let shared = 0

  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1

  const up = new Array(from.length - shared).fill("..")
  const walk = up.concat(to.slice(shared))

  return walk.length === 0 ? "." : walk.join("/")
}

function join(project: string, path: string): string {
  return `${project.replace(/\/+$/, "")}/${path}`
}

export class SourcePath {
  readonly path: string
  readonly line: number | null
  readonly column: number | null
  readonly projectPath: string | null
  readonly scheme: string | null

  constructor(
    path: string,
    options: {
      projectPath?: string | null
      line?: number | null
      column?: number | null
      scheme?: string | null
    } = {},
  ) {
    const line = options.line ?? null

    this.path = path
    this.projectPath = options.projectPath ?? null
    this.line = line
    this.column = line === null ? null : (options.column ?? null)
    this.scheme = options.scheme ?? null

    Object.freeze(this)
  }

  static at(path: string, position: Position | null,options: { projectPath?: string | null; scheme?: string | null } = {}): SourcePath {
    const { projectPath = null, scheme = null } = options

    if (!position) return new SourcePath(path, { projectPath, scheme })

    return new SourcePath(path, { projectPath, scheme, line: position.line, column: position.column })
  }

  static parse(string: string, projectPath: string | null = null): SourcePath | null {
    const match = PATTERN.exec(string)
    if (!match) return null

    const [, scheme, path, line, column] = match

    if (!path) return null

    return new SourcePath(path, {
      projectPath,
      line: line === undefined ? null : Number(line),
      column: reportedColumn(column),
      scheme: scheme ?? null,
    })
  }

  get position(): Position | null {
    if (this.line === null) return null

    return Position.from(this.line, this.column ?? 0)
  }

  get hasPosition(): boolean {
    return this.line !== null
  }

  get isAbsolute(): boolean {
    return isAbsolute(this.path)
  }

  get absolutePath(): string {
    if (this.isAbsolute || this.projectPath === null) return this.path

    return join(this.projectPath, this.path)
  }

  get relativePath(): string {
    if (this.projectPath === null) return this.path

    return relativeFrom(this.absolutePath, this.projectPath)
  }

  get absolute(): SourcePath {
    return this.withPath(this.absolutePath)
  }

  get relative(): SourcePath {
    return this.withPath(this.relativePath)
  }

  withPath(path: string): SourcePath {
    return new SourcePath(path, {
      projectPath: this.projectPath,
      line: this.line,
      column: this.column,
      scheme: this.scheme,
    })
  }

  withProjectPath(projectPath: string | null): SourcePath {
    return new SourcePath(this.path, {
      projectPath,
      line: this.line,
      column: this.column,
      scheme: this.scheme,
    })
  }

  withPosition(position: Position | null): SourcePath {
    return SourcePath.at(this.path, position, { projectPath: this.projectPath, scheme: this.scheme })
  }

  withScheme(scheme: string | null): SourcePath {
    return new SourcePath(this.path, {
      projectPath: this.projectPath,
      line: this.line,
      column: this.column,
      scheme,
    })
  }

  equals(other: SourcePath): boolean {
    return this.toString() === other.toString()
  }

  toString(): string {
    return `${this.prefix()}${this.writtenPath()}${this.suffix()}`
  }

  inspect(): string {
    return `#<Herb::SourcePath ${this.toString()}>`
  }

  private prefix(): string {
    return this.scheme ? `${this.scheme}${FILE_SCHEME_SEPARATOR}` : ""
  }

  private writtenPath(): string {
    if (!this.scheme) return this.path

    return this.path.startsWith("/") ? this.path : `/${this.path}`
  }

  private suffix(): string {
    if (this.line === null) return ""

    return this.column === null ? `:${this.line}` : `:${this.line}:${this.column + 1}`
  }
}
