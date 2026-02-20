import { expect } from "vitest"
import { Formatter } from "../src"

export function createExpectFormattedToMatch(formatter: Formatter) {
  return function expectFormattedToMatch(source: string) {
    const result = formatter.format(source)
    expect(result).toEqual(source)
  }
}
