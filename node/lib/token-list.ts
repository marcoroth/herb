import { Token } from './token.js';

export class TokenList implements Iterable<Token> {
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  get length(): number {
    return this.tokens.length;
  }

  [Symbol.iterator](): Iterator<Token> {
    return this.tokens[Symbol.iterator]();
  }

  at(index: number): Token | undefined {
    return this.tokens.at(index);
  }

  forEach(callback: (token: Token, index: number, array: Token[]) => void): void {
    this.tokens.forEach(callback);
  }

  map<U>(callback: (token: Token, index: number, array: Token[]) => U): U[] {
    return this.tokens.map(callback);
  }

  filter(predicate: (token: Token, index: number, array: Token[]) => boolean): Token[] {
    return this.tokens.filter(predicate);
  }

  __getobj__(): Token[] {
    return this.tokens;
  }

  inspect(): string {
    return this.tokens.map(token => token.inspect()).join('\n') + '\n';
  }

  toString(): string {
    return this.inspect();
  }
}
