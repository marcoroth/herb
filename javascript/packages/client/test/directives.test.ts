import { describe, test, expect } from "vitest"
import { mentionsAnyState } from "../src/directives"

describe("mentionsAnyState", () => {
  test("a bare read mentions the state", () => {
    expect(mentionsAnyState("open", ["open"])).toBe(true)
    expect(mentionsAnyState("open?", ["open"])).toBe(true)
  })

  test("a negated read still mentions the state", () => {
    expect(mentionsAnyState("!open", ["open"])).toBe(true)
    expect(mentionsAnyState("!!open", ["open"])).toBe(true)
  })

  test("a longer name is not a mention", () => {
    expect(mentionsAnyState("reopen", ["open"])).toBe(false)
    expect(mentionsAnyState("open_at", ["open"])).toBe(false)
    expect(mentionsAnyState("open!", ["open"])).toBe(false)
  })
})
