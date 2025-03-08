export class Location {
  readonly line: number;
  readonly column: number;

  constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }

  toHash(): Record<string, number> {
    return { line: this.line, column: this.column };
  }

  toJSON(): Record<string, number> {
    return this.toHash();
  }

  treeInspect(): string {
    return `(${this.line}:${this.column})`;
  }

  inspect(): string {
    return `#<Location ${this.treeInspect()}>`;
  }

  toString(): string {
    return this.inspect();
  }
}
