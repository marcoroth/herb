import { describe, test, expect } from "vitest"

import { armOf, matches, mentions, statesIn } from "../src/conditions"

import type { ConditionalArm, StateCondition, ConditionValue } from "../src/conditions"

const VALUES: Record<string, ConditionValue> = {
  pending: true,
  failed: false,
  attempts: 4,
  limit: 3,
  sort: "name",
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
