import { Token, SerializedToken } from "./token.js"

export type SerializedTokenList = SerializedToken[]

export class TokenList implements Iterable<Token> {
  private list: Token[]

  static from(list: SerializedTokenList) {
    return new TokenList(
      list.map((token: SerializedToken) => Token.from(token)),
    )
  }

  constructor(list: Token[]) {
    this.list = list
  }

  get length(): number {
    return this.list.length
  }

  get tokens(): Token[] {
    return this.list
  }

  [Symbol.iterator](): Iterator<Token> {
    return this.list[Symbol.iterator]()
  }

  at(index: number): Token | undefined {
    return this.list.at(index)
  }

  forEach(
    callback: (token: Token, index: number, array: Token[]) => void,
  ): void {
    this.list.forEach(callback)
  }

  map<U>(callback: (token: Token, index: number, array: Token[]) => U): U[] {
    return this.list.map(callback)
  }

  filter(
    predicate: (token: Token, index: number, array: Token[]) => boolean,
  ): Token[] {
    return this.list.filter(predicate)
  }

  __getobj__(): Token[] {
    return this.list
  }

  inspect(): string {
    return this.list.map((token) => token.inspect()).join("\n") + "\n"
  }

  toString(): string {
    return this.inspect()
  }
}
