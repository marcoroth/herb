import { describe, test, expect } from "vitest"

import { matches } from "../src/state/conditions"

import type { ConditionValue, StateCondition } from "../src/state/types"

/**
 * The condition the compiler writes for
 *
 *   <% if !((message.length > count) && !(message == "abc" || count == 0)) %>
 *
 * with `(message: "", count: 0)` declared. Every row below is the answer Ruby gives for the
 * original expression, so this pins De Morgan against the language rather than against itself.
 */
const CONDITION: StateCondition = {
  any: [
    ["message", { state: "count" }, "<=", "length"],
    { any: [["message", { value: "abc" }, "=="], ["count", { value: 0 }, "=="]] },
  ],
}

const RUBY_ANSWERS: [string, number, boolean][] = [
  ["", 0, true],
  ["", 1, true],
  ["", 3, true],
  ["", 5, true],
  ["abc", 0, true],
  ["abc", 1, true],
  ["abc", 3, true],
  ["abc", 5, true],
  ["hello", 0, true],
  ["hello", 1, false],
  ["hello", 3, false],
  ["hello", 5, true],
  ["hi", 0, true],
  ["hi", 1, false],
  ["hi", 3, true],
  ["hi", 5, true],
]

describe("a negated combination the compiler rewrote with De Morgan", () => {
  test("answers what Ruby answers for the original expression", () => {
    const answers = RUBY_ANSWERS.map(([message, count]) => {
      const valueOf = (name: string): ConditionValue => (name === "message" ? message : count)

      return [message, count, matches(CONDITION, valueOf)] as [string, number, boolean]
    })

    expect(answers).toEqual(RUBY_ANSWERS)
  })
})
