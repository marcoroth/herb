import { expect } from "vitest"
import { Formatter } from "../src"

export interface ExpectFormattedToMatchOptions {
  passes?: number
}

export function createExpectFormattedToMatch(formatter: Formatter) {
  return function expectFormattedToMatch(source: string, options: ExpectFormattedToMatchOptions = {}) {
    const { passes = 1 } = options

    let result = source

    for (let pass = 0; pass < passes; pass++) {
      result = formatter.format(result)
    }

    expect(result).toEqual(source)
  }
}
