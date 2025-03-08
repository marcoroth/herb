import { Range } from './range.js';
import { Location } from './location.js';

export class Token {
  readonly value: string;
  readonly range: Range;
  readonly startLocation: Location;
  readonly endLocation: Location;
  readonly type: string;

  constructor(
    value: string,
    range: Range,
    startLocation: Location,
    endLocation: Location,
    type: string
  ) {
    this.value = value;
    this.range = range;
    this.startLocation = startLocation;
    this.endLocation = endLocation;
    this.type = type;
  }

  toHash(): Record<string, any> {
    return {
      value: this.value,
      range: this.range?.toArray(),
      start_location: this.startLocation?.toHash(),
      end_location: this.endLocation?.toHash(),
      type: this.type,
    };
  }

  toJSON(): Record<string, any> {
    return this.toHash();
  }

  treeInspect(): string {
    return `"${this.value}" (location: ${this.startLocation.treeInspect()}-${this.endLocation.treeInspect()})`;
  }

  inspect(): string {
    return `#<Token type="${this.type}" value=${JSON.stringify(this.value)} range=${this.range.treeInspect()} start=${this.startLocation.treeInspect()} end=${this.endLocation.treeInspect()}>`;
  }

  toString(): string {
    return this.inspect();
  }
}
