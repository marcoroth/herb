import { describe, test, expect } from "vitest"

import { armOf, evaluate, matches, mentions, statesIn } from "../src/state/conditions"

import type { ConditionalArm, StateCondition, ConditionValue } from "../src/state/types"

const VALUES: Record<string, ConditionValue> = {
  pending: true,
  failed: false,
  attempts: 4,
  limit: 3,
  sort: "name",
  draft: "",
  spaced: "   ",
  note: null,
}

function valueOf(name: string): ConditionValue {
  return VALUES[name] ?? null
}

describe("a condition the compiler wrote", () => {
  test("reads a state for its truth", () => {
    expect(matches(["pending", null], valueOf)).toBe(true)
    expect(matches(["failed", null], valueOf)).toBe(false)
  })

  test("compares a state against the value it was given", () => {
    expect(matches(["sort", { value: "name" }], valueOf)).toBe(true)
    expect(matches(["sort", { value: "date" }], valueOf)).toBe(false)
    expect(matches(["sort", { value: "date" }, "!="], valueOf)).toBe(true)
  })

  test("orders a state against a number", () => {
    expect(matches(["attempts", { value: 3 }, ">"], valueOf)).toBe(true)
    expect(matches(["attempts", { value: 4 }, ">="], valueOf)).toBe(true)
    expect(matches(["attempts", { value: 4 }, "<"], valueOf)).toBe(false)
  })

  test("compares a state against another state", () => {
    expect(matches(["attempts", { state: "limit" }, ">"], valueOf)).toBe(true)
    expect(matches(["limit", { state: "attempts" }, ">"], valueOf)).toBe(false)
  })

  test("reads a state for blankness the way ActiveSupport does", () => {
    expect(matches(["draft", null, "blank"], valueOf)).toBe(true)
    expect(matches(["spaced", null, "blank"], valueOf)).toBe(true)
    expect(matches(["sort", null, "blank"], valueOf)).toBe(false)
    expect(matches(["note", null, "blank"], valueOf)).toBe(true)
    expect(matches(["failed", null, "blank"], valueOf)).toBe(true)
    expect(matches(["pending", null, "blank"], valueOf)).toBe(false)
    expect(matches(["attempts", null, "blank"], valueOf)).toBe(false)
  })

  test("reads a state for presence as the opposite of blankness", () => {
    expect(matches(["draft", null, "present"], valueOf)).toBe(false)
    expect(matches(["spaced", null, "present"], valueOf)).toBe(false)
    expect(matches(["sort", null, "present"], valueOf)).toBe(true)
    expect(matches(["note", null, "present"], valueOf)).toBe(false)
  })

  test("compares a transformed read against a number", () => {
    expect(matches(["sort", { value: 4 }, "==", "length"], valueOf)).toBe(true)
    expect(matches(["sort", { value: 3 }, ">", "length"], valueOf)).toBe(true)
    expect(matches(["sort", { value: 4 }, ">", "length"], valueOf)).toBe(false)
    expect(matches(["draft", { value: 0 }, "==", "length"], valueOf)).toBe(true)
  })

  test("counts length the way Ruby does, by codepoint", () => {
    const emoji = (name: string): ConditionValue => (name === "wave" ? "\u{1F44B}a" : "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}")

    expect(evaluate(["wave", null, null, "length"], emoji)).toBe(2)
    expect(evaluate(["family", null, null, "length"], emoji)).toBe(5)
  })

  test("resolves a bare transformed read to its value, not to a boolean", () => {
    expect(evaluate(["sort", null, null, "length"], valueOf)).toBe(4)
    expect(evaluate(["spaced", null, null, "length"], valueOf)).toBe(3)
    expect(evaluate(["sort", { value: 4 }, "==", "length"], valueOf)).toBe(true)
    expect(evaluate(["sort", { value: "name" }], valueOf)).toBe(true)
  })

  test("stringifies a read the way Ruby's to_s does", () => {
    const kinds = (name: string): ConditionValue => ({ yes: true, no: false, none: null, word: "hi", blank: "", num: -5 })[name] ?? null

    expect(evaluate(["yes", null, null, "to_s"], kinds)).toBe("true")
    expect(evaluate(["no", null, null, "to_s"], kinds)).toBe("false")
    expect(evaluate(["none", null, null, "to_s"], kinds)).toBe("")
    expect(evaluate(["word", null, null, "to_s"], kinds)).toBe("hi")
    expect(evaluate(["blank", null, null, "to_s"], kinds)).toBe("")
    expect(evaluate(["num", null, null, "to_s"], kinds)).toBe("-5")
    expect(matches(["num", { value: "-5" }, "==", "to_s"], kinds)).toBe(true)
  })

  test("compares a transformed read against another state", () => {
    expect(matches(["attempts", { state: "limit" }, ">"], valueOf)).toBe(true)
    expect(matches(["sort", { state: "draft" }, "==", "to_s"], valueOf)).toBe(false)
  })

  test("negates a read the way `!` does", () => {
    expect(matches(["pending", null, "falsy"], valueOf)).toBe(false)
    expect(matches(["failed", null, "falsy"], valueOf)).toBe(true)
    expect(matches(["note", null, "falsy"], valueOf)).toBe(true)
    expect(matches(["draft", null, "falsy"], valueOf)).toBe(false)
    expect(matches(["attempts", null, "falsy"], valueOf)).toBe(false)
  })

  test("joins conditions", () => {
    expect(matches({ all: [["pending", null], ["attempts", { value: 3 }, ">"]] }, valueOf)).toBe(true)
    expect(matches({ all: [["pending", null], ["failed", null]] }, valueOf)).toBe(false)
    expect(matches({ any: [["failed", null], ["pending", null]] }, valueOf)).toBe(true)
  })

  test("says which states it reads", () => {
    expect(statesIn(["attempts", { state: "limit" }, ">"])).toEqual(["attempts", "limit"])
    expect(mentions(["attempts", { state: "limit" }, ">"], ["limit"])).toBe(true)
    expect(mentions(["attempts", { value: 3 }, ">"], ["limit"])).toBe(false)
    expect(mentions({ any: [["failed", null], ["pending", null]] }, ["pending"])).toBe(true)
  })
})

describe("an arm", () => {
  test("carries the branch its condition selects", () => {
    const arm: ConditionalArm = { branch: 1, condition: ["pending", null] }

    expect(armOf(arm)).toEqual({ branch: 1, condition: ["pending", null] })
  })

  test("reads the same when a server spells it the way it used to", () => {
    const shapes: [ConditionalArm, StateCondition][] = [
      [["pending", null, 1], ["pending", null]],
      [["attempts", "3", 0, ">"], ["attempts", "3", ">"]],
      [{ any: [["failed", null], ["pending", null]], branch: 2 }, { any: [["failed", null], ["pending", null]] }],
    ]

    for (const [arm, condition] of shapes) {
      expect(armOf(arm).condition).toEqual(condition)
    }

    expect(armOf(["attempts", "3", 0, ">"]).branch).toBe(0)
    expect(matches(armOf(["attempts", "3", 0, ">"]).condition, valueOf)).toBe(true)
    expect(matches(armOf(["sort", '"name"', 0]).condition, valueOf)).toBe(true)
  })
})
